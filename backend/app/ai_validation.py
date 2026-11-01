from __future__ import annotations

import json
import re
import ssl
from dataclasses import dataclass
from html import unescape
from typing import Any
from urllib import error, parse, request

import certifi
from fastapi import HTTPException

from app.config import (
    AI_VALIDATION_API_KEY,
    AI_VALIDATION_API_URL,
    AI_VALIDATION_ENABLED,
    AI_VALIDATION_MODEL,
    AI_VALIDATION_PROVIDER,
)
from app.db import supabase

RECOMMENDED = "recommended"
NEEDS_REVIEW = "needs_review"
HIGH_RISK = "high_risk"
HTTPS_CONTEXT = ssl.create_default_context(cafile=certifi.where())


@dataclass
class ValidationReview:
    provider: str
    status: str
    review_mode: str
    recommendation: str | None
    summary: str
    confidence: int
    relevance_score: int
    completeness_score: int
    risk_score: int
    flags: list[str]
    evidence_preview: str | None = None
    code_signals: dict[str, Any] | None = None
    raw_response: dict[str, Any] | None = None

    def to_row(self, submission_id: str, bounty_id: str) -> dict[str, Any]:
        return {
            "submissionId": submission_id,
            "bountyId": bounty_id,
            "provider": self.provider,
            "status": self.status,
            "reviewMode": self.review_mode,
            "recommendation": self.recommendation,
            "summary": self.summary,
            "confidence": self.confidence,
            "relevanceScore": self.relevance_score,
            "completenessScore": self.completeness_score,
            "riskScore": self.risk_score,
            "flags": self.flags,
            "evidencePreview": self.evidence_preview,
            "codeSignals": self.code_signals,
            "rawResponse": self.raw_response,
        }


def _retry_ai_review_upsert_without_missing_columns(review_row: dict[str, Any], error_message: str):
    fallback_row = dict(review_row)
    lowered = error_message.lower()

    missing_columns = []
    for column in ("codeSignals", "reviewMode", "evidencePreview", "rawResponse"):
        if column.lower() in lowered:
            missing_columns.append(column)

    if not missing_columns:
        raise RuntimeError(error_message)

    for column in missing_columns:
        fallback_row.pop(column, None)

    response = (
        supabase.table("ai_reviews")
        .upsert(fallback_row, on_conflict="submissionId")
        .execute()
    )
    result = (response.data or [fallback_row])[0]

    for column in missing_columns:
        result.setdefault(column, None)
    return result


def _clamp_score(value: int) -> int:
    return max(0, min(100, value))


def _tokenize(text: str) -> set[str]:
    return {
        token
        for token in re.findall(r"[a-z0-9]{3,}", text.lower())
        if token not in {"the", "and", "for", "with", "that", "this", "your", "from", "have"}
    }


def _parse_json_content(content: str) -> dict[str, Any]:
    normalized = content.strip()
    if normalized.startswith("```"):
        normalized = re.sub(r"^```[a-zA-Z0-9_-]*\s*", "", normalized)
        normalized = re.sub(r"\s*```$", "", normalized)
        normalized = normalized.strip()
    return json.loads(normalized)


def _link_domain_score(proof_link: str) -> int:
    url = proof_link.lower()
    if "github.com" in url or "gitlab.com" in url:
        return 32
    if "ipfs" in url or "arweave" in url:
        return 28
    if any(domain in url for domain in ("vercel.app", "netlify.app", "render.com")):
        return 24
    if url.startswith("https://"):
        return 18
    if url.startswith("http://"):
        return 10
    return 0


def _http_get_json(url: str, headers: dict[str, str] | None = None) -> Any:
    req = request.Request(url, headers=headers or {}, method="GET")
    with request.urlopen(req, timeout=15, context=HTTPS_CONTEXT) as response:
        return json.loads(response.read().decode("utf-8"))


def _http_get_text(url: str, headers: dict[str, str] | None = None) -> str:
    req = request.Request(url, headers=headers or {}, method="GET")
    with request.urlopen(req, timeout=15, context=HTTPS_CONTEXT) as response:
        return response.read().decode("utf-8", errors="ignore")


def _is_reviewable_code_file(name: str) -> bool:
    lowered = name.lower()
    return lowered.endswith(
        (
            ".py",
            ".js",
            ".jsx",
            ".ts",
            ".tsx",
            ".sol",
            ".rs",
            ".go",
            ".java",
            ".md",
        )
    )


def _looks_like_test_file(name: str) -> bool:
    lowered = name.lower()
    return any(
        token in lowered
        for token in ("test", "spec", "pytest", ".t.sol", ".test.", ".spec.")
    )


def _github_repo_details(proof_link: str) -> tuple[str, str] | None:
    parsed = parse.urlparse(proof_link)
    if parsed.netloc.lower() not in {"github.com", "www.github.com"}:
        return None

    segments = [segment for segment in parsed.path.split("/") if segment]
    if len(segments) < 2:
        return None
    return segments[0], segments[1]


def _build_code_signals_from_names(file_names: list[str]) -> dict[str, Any]:
    lowered_names = [name.lower() for name in file_names]
    return {
        "testsPresent": any(_looks_like_test_file(name) for name in file_names),
        "ciPresent": any(name in {".github", ".gitlab-ci.yml", "dockerfile"} for name in lowered_names),
        "docsPresent": any(name.startswith("readme") or name.endswith(".md") for name in lowered_names),
        "contractsPresent": any(
            token in name for name in lowered_names for token in ("contract", ".sol", "pyteal", "teal")
        ),
        "frontendPresent": any(token in name for name in lowered_names for token in ("app", "src", "components", "next.config")),
        "backendPresent": any(token in name for name in lowered_names for token in ("backend", "api", "fastapi", "requirements")),
    }


def _fetch_github_repo_snapshot(owner: str, repo: str, default_branch: str, headers: dict[str, str]) -> dict[str, Any]:
    repo_payload = _http_get_json(f"https://api.github.com/repos/{owner}/{repo}", headers=headers)
    tree_payload = _http_get_json(
        f"https://api.github.com/repos/{owner}/{repo}/git/trees/{default_branch}?recursive=1",
        headers=headers,
    )
    tree_items = tree_payload.get("tree") or []
    file_paths = [
        item.get("path", "")
        for item in tree_items
        if item.get("type") == "blob" and item.get("path")
    ]

    code_paths = [
        path for path in file_paths
        if _is_reviewable_code_file(path) and len(path.split("/")) <= 4
    ][:5]
    sampled_files: list[dict[str, str]] = []
    for path in code_paths:
        encoded_path = parse.quote(path)
        try:
            file_payload = _http_get_json(
                f"https://api.github.com/repos/{owner}/{repo}/contents/{encoded_path}?ref={default_branch}",
                headers=headers,
            )
        except Exception:
            continue
        download_url = file_payload.get("download_url")
        if not download_url:
            continue
        try:
            file_text = _http_get_text(download_url, headers={"User-Agent": "BountyBase-AI-Validator"})
        except Exception:
            continue
        compact_file_text = re.sub(r"\s+", " ", file_text).strip()
        if compact_file_text:
            sampled_files.append(
                {
                    "path": path,
                    "excerpt": compact_file_text[:700],
                }
            )

    return {
        "repo": repo_payload,
        "filePaths": file_paths,
        "sampledFiles": sampled_files,
        "codeSignals": _build_code_signals_from_names(file_paths[:200]),
    }


def _extract_github_evidence(proof_link: str) -> str | None:
    repo_details = _github_repo_details(proof_link)
    if not repo_details:
        return None

    owner, repo = repo_details
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "BountyBase-AI-Validator",
    }

    evidence_parts: list[str] = [f"GitHub repo: {owner}/{repo}"]

    try:
        repo_payload = _http_get_json(f"https://api.github.com/repos/{owner}/{repo}", headers=headers)
        description = repo_payload.get("description")
        default_branch = repo_payload.get("default_branch") or "main"
        language = repo_payload.get("language")
        evidence_parts.append(f"Default branch: {default_branch}")
        if description:
            evidence_parts.append(f"Repo description: {description}")
        if language:
            evidence_parts.append(f"Primary language: {language}")
    except Exception:
        default_branch = "main"

    try:
        readme_payload = _http_get_json(f"https://api.github.com/repos/{owner}/{repo}/readme", headers=headers)
        download_url = readme_payload.get("download_url")
        if download_url:
            readme_text = _http_get_text(download_url, headers={"User-Agent": "BountyBase-AI-Validator"})
            compact_readme = re.sub(r"\s+", " ", readme_text).strip()
            if compact_readme:
                evidence_parts.append(f"README excerpt: {compact_readme[:700]}")
    except Exception:
        pass

    try:
        snapshot = _fetch_github_repo_snapshot(owner, repo, default_branch, headers)
        file_paths = snapshot["filePaths"]
        if file_paths:
            evidence_parts.append(
                "Repository structure: " + ", ".join(file_paths[:12])
            )
        for sampled_file in snapshot["sampledFiles"][:3]:
            evidence_parts.append(
                f"Sample file {sampled_file['path']}: {sampled_file['excerpt']}"
            )
    except Exception:
        pass

    return "\n".join(evidence_parts) if len(evidence_parts) > 1 else None


def extract_code_signals(proof_link: str) -> dict[str, Any] | None:
    repo_details = _github_repo_details(proof_link)
    if not repo_details:
        return None

    owner, repo = repo_details
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "BountyBase-AI-Validator",
    }
    try:
        repo_payload = _http_get_json(f"https://api.github.com/repos/{owner}/{repo}", headers=headers)
        default_branch = repo_payload.get("default_branch") or "main"
        snapshot = _fetch_github_repo_snapshot(owner, repo, default_branch, headers)
    except Exception:
        return None

    code_signals = dict(snapshot["codeSignals"])
    code_signals["sampledFiles"] = [sampled_file["path"] for sampled_file in snapshot["sampledFiles"]]
    code_signals["totalFilesScanned"] = len(snapshot["filePaths"])
    code_signals["repoLanguage"] = repo_payload.get("language")
    return code_signals


def _review_mode_for_link(proof_link: str) -> str:
    return "github_repo" if _github_repo_details(proof_link) else "generic_link"


def _extract_generic_evidence(proof_link: str) -> str | None:
    if not proof_link.startswith(("http://", "https://")):
        return None
    try:
        html = _http_get_text(
            proof_link,
            headers={"User-Agent": "BountyBase-AI-Validator"},
        )
    except Exception:
        return None

    title_match = re.search(r"<title>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
    title = unescape(title_match.group(1)).strip() if title_match else ""
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return f"Reachable URL: {proof_link}"
    preview = text[:500]
    if title:
        return f"Page title: {title}\nPage preview: {preview}"
    return f"Page preview: {preview}"


def extract_proof_evidence(proof_link: str) -> str | None:
    return _extract_github_evidence(proof_link) or _extract_generic_evidence(proof_link)


def _heuristic_review(bounty: dict, submission: dict) -> ValidationReview:
    bounty_title = str(bounty.get("title") or "")
    bounty_description = str(bounty.get("description") or "")
    submission_description = str(submission.get("description") or "")
    proof_link = str(submission.get("proofLink") or "")
    evidence_preview = extract_proof_evidence(proof_link)
    code_signals = extract_code_signals(proof_link)

    bounty_tokens = _tokenize(f"{bounty_title} {bounty_description}")
    submission_tokens = _tokenize(submission_description)
    overlap = len(bounty_tokens & submission_tokens)
    overlap_ratio = overlap / max(len(bounty_tokens), 1)

    flags: list[str] = []

    relevance_score = _clamp_score(int(35 + overlap_ratio * 55))
    if overlap < 3:
        flags.append("Low keyword overlap with the bounty brief")
        relevance_score = min(relevance_score, 54)

    description_length = len(submission_description.strip())
    completeness_score = 15
    if description_length >= 500:
        completeness_score += 45
    elif description_length >= 250:
        completeness_score += 34
    elif description_length >= 120:
        completeness_score += 24
    elif description_length >= 60:
        completeness_score += 14
    else:
        flags.append("Submission description is very short")

    completeness_score += _link_domain_score(proof_link)
    if not proof_link.startswith(("http://", "https://")):
        flags.append("Proof link is missing a valid URL format")

    if proof_link and "github.com" not in proof_link.lower() and "ipfs" not in proof_link.lower():
        flags.append("Proof link is not a code repository or decentralized storage link")

    if any(term in proof_link.lower() for term in ("localhost", "127.0.0.1", "example.com")):
        flags.append("Proof link looks like a placeholder or local-only URL")

    completeness_score = _clamp_score(completeness_score)

    risk_score = 18
    if description_length < 80:
        risk_score += 28
    if "example.com" in proof_link.lower():
        risk_score += 30
    if "github.com" not in proof_link.lower() and "ipfs" not in proof_link.lower():
        risk_score += 12
    if overlap < 3:
        risk_score += 18
    if overlap_ratio > 0.2 and description_length >= 120:
        risk_score -= 10
    if evidence_preview:
        completeness_score = _clamp_score(completeness_score + 10)
        risk_score = max(0, risk_score - 8)
    else:
        flags.append("AI could not extract visible evidence from the proof link")
    risk_score = _clamp_score(risk_score)

    if code_signals:
        if code_signals.get("testsPresent"):
            completeness_score = _clamp_score(completeness_score + 8)
            risk_score = max(0, risk_score - 6)
        else:
            flags.append("Repository does not expose obvious test files")

        if code_signals.get("ciPresent"):
            completeness_score = _clamp_score(completeness_score + 4)
        else:
            flags.append("Repository does not expose obvious CI or build automation files")

        if code_signals.get("contractsPresent"):
            relevance_score = _clamp_score(relevance_score + 6)

    if risk_score >= 65:
        recommendation = HIGH_RISK
    elif relevance_score >= 65 and completeness_score >= 60 and risk_score <= 40:
        recommendation = RECOMMENDED
    else:
        recommendation = NEEDS_REVIEW

    confidence = _clamp_score(int((relevance_score + completeness_score + (100 - risk_score)) / 3))
    summary = (
        f"AI advisory review sees {recommendation.replace('_', ' ')}. "
        f"Relevance {relevance_score}/100, completeness {completeness_score}/100, risk {risk_score}/100."
    )

    return ValidationReview(
        provider="heuristic",
        status="completed",
        review_mode=_review_mode_for_link(proof_link),
        recommendation=recommendation,
        summary=summary,
        confidence=confidence,
        relevance_score=relevance_score,
        completeness_score=completeness_score,
        risk_score=risk_score,
        flags=flags,
        evidence_preview=evidence_preview,
        code_signals=code_signals,
        raw_response={
            "overlap": overlap,
            "overlapRatio": round(overlap_ratio, 4),
            "descriptionLength": description_length,
        },
    )


def _openai_compatible_review(bounty: dict, submission: dict) -> ValidationReview:
    if not AI_VALIDATION_API_KEY:
        raise RuntimeError("AI_VALIDATION_API_KEY is required for openai_compatible validation")

    proof_link = str(submission.get("proofLink") or "")
    evidence_preview = extract_proof_evidence(proof_link)
    code_signals = extract_code_signals(proof_link)
    prompt = {
        "bounty": {
            "title": bounty.get("title"),
            "description": bounty.get("description"),
            "reward": bounty.get("reward"),
            "deadline": bounty.get("deadline"),
        },
        "submission": {
            "description": submission.get("description"),
            "proofLink": submission.get("proofLink"),
            "submitter": submission.get("submitter"),
        },
        "proofEvidence": evidence_preview,
        "codeSignals": code_signals,
        "instructions": (
            "Return JSON only with keys: recommendation, summary, confidence, relevanceScore, "
            "completenessScore, riskScore, flags. recommendation must be one of "
            "recommended, needs_review, high_risk. confidence and scores must be integers 0-100. "
            "flags must be an array of short strings. If the proof link looks like a GitHub repository, "
            "evaluate whether the repository evidence plausibly matches the bounty requirements and call out code quality, tests, and project structure risk when visible."
        ),
    }
    body = {
        "model": AI_VALIDATION_MODEL,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are an AI validation assistant for a freelance bounty marketplace. "
                    "You only provide advisory analysis and must never claim final authority."
                ),
            },
            {"role": "user", "content": json.dumps(prompt)},
        ],
        "response_format": {"type": "json_object"},
    }
    req = request.Request(
        AI_VALIDATION_API_URL,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {AI_VALIDATION_API_KEY}",
        },
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=20, context=HTTPS_CONTEXT) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        raise RuntimeError(f"AI provider rejected the request with status {exc.code}") from exc
    except Exception as exc:
        raise RuntimeError("AI provider request failed") from exc

    try:
        content = payload["choices"][0]["message"]["content"]
        review = _parse_json_content(content)
    except Exception as exc:
        raise RuntimeError("AI provider returned an unreadable response") from exc

    recommendation = review.get("recommendation")
    if recommendation not in {RECOMMENDED, NEEDS_REVIEW, HIGH_RISK}:
        recommendation = NEEDS_REVIEW

    return ValidationReview(
        provider="openai_compatible",
        status="completed",
        review_mode=_review_mode_for_link(proof_link),
        recommendation=recommendation,
        summary=str(review.get("summary") or "AI advisory review completed."),
        confidence=_clamp_score(int(review.get("confidence") or 0)),
        relevance_score=_clamp_score(int(review.get("relevanceScore") or 0)),
        completeness_score=_clamp_score(int(review.get("completenessScore") or 0)),
        risk_score=_clamp_score(int(review.get("riskScore") or 0)),
        flags=[str(flag) for flag in (review.get("flags") or [])],
        evidence_preview=evidence_preview,
        code_signals=code_signals,
        raw_response=payload,
    )


def generate_ai_review(bounty: dict, submission: dict) -> ValidationReview:
    if not AI_VALIDATION_ENABLED:
        return ValidationReview(
            provider="disabled",
            status="skipped",
            review_mode="disabled",
            recommendation=None,
            summary="AI validation is disabled for this environment.",
            confidence=0,
            relevance_score=0,
            completeness_score=0,
            risk_score=0,
            flags=[],
        )

    if AI_VALIDATION_PROVIDER == "openai_compatible":
        try:
            return _openai_compatible_review(bounty, submission)
        except Exception as exc:
            fallback_review = _heuristic_review(bounty, submission)
            fallback_flags = list(fallback_review.flags)
            fallback_flags.insert(
                0,
                f"Model-backed AI review unavailable: {exc}. Showing heuristic fallback instead.",
            )
            return ValidationReview(
                provider="heuristic_fallback",
                status="completed",
                review_mode=fallback_review.review_mode,
                recommendation=fallback_review.recommendation,
                summary=(
                    "Model-backed AI review is temporarily unavailable, so a heuristic advisory review was used. "
                    + fallback_review.summary
                ),
                confidence=fallback_review.confidence,
                relevance_score=fallback_review.relevance_score,
                completeness_score=fallback_review.completeness_score,
                risk_score=fallback_review.risk_score,
                flags=fallback_flags,
                evidence_preview=fallback_review.evidence_preview,
                code_signals=fallback_review.code_signals,
                raw_response={
                    "fallbackReason": str(exc),
                    "fallbackProvider": "heuristic",
                },
            )

    return _heuristic_review(bounty, submission)


def create_or_update_submission_ai_review(bounty: dict, submission: dict) -> dict[str, Any]:
    try:
        review = generate_ai_review(bounty, submission)
    except Exception as exc:
        failed_review = ValidationReview(
            provider=AI_VALIDATION_PROVIDER or "heuristic",
            status="failed",
            review_mode="failed",
            recommendation=None,
            summary=f"AI validation could not complete: {exc}",
            confidence=0,
            relevance_score=0,
            completeness_score=0,
            risk_score=0,
            flags=["AI validation failed and needs a manual re-run"],
            evidence_preview=None,
        )
        review_row = failed_review.to_row(submission["id"], submission["bountyId"])
    else:
        review_row = review.to_row(submission["id"], submission["bountyId"])

    try:
        response = (
            supabase.table("ai_reviews")
            .upsert(review_row, on_conflict="submissionId")
            .execute()
        )
        return (response.data or [review_row])[0]
    except Exception as exc:
        message = str(exc)
        if "PGRST204" not in message and "schema cache" not in message:
            raise
        return _retry_ai_review_upsert_without_missing_columns(review_row, message)


def refresh_submission_ai_review(submission_id: str) -> dict[str, Any]:
    submission_res = (
        supabase.table("submissions")
        .select("*")
        .eq("id", submission_id)
        .limit(1)
        .execute()
    )
    if not submission_res.data:
        raise HTTPException(status_code=404, detail="Submission not found")

    submission = submission_res.data[0]
    bounty_res = (
        supabase.table("bounties")
        .select("id, title, description, reward, deadline, creator, escrowMode, contractAppId")
        .eq("id", submission["bountyId"])
        .limit(1)
        .execute()
    )
    if not bounty_res.data:
        raise HTTPException(status_code=404, detail="Bounty not found for this submission")

    return create_or_update_submission_ai_review(bounty_res.data[0], submission)


def get_ai_reviews_by_submission_ids(submission_ids: list[str]) -> dict[str, dict[str, Any]]:
    if not submission_ids:
        return {}

    response = (
        supabase.table("ai_reviews")
        .select("*")
        .in_("submissionId", submission_ids)
        .execute()
    )
    return {
        row["submissionId"]: row
        for row in (response.data or [])
        if row.get("submissionId")
    }
