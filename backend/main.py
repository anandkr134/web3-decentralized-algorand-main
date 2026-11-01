# ---------- Python 3.14 + macOS importlib hang workaround ----------
# importlib.metadata.distributions() hangs indefinitely on Python 3.14
# in certain venv + macOS setups. This blocks packages_distributions(),
# entry_points(), and anything else that iterates installed packages.
# Pydantic (via FastAPI) and google-cloud-firestore both trigger this.
# We patch the three affected functions before ANY library imports.
import importlib.metadata as _im

class _EmptyEntryPoints(list):
    """Minimal stand-in for importlib.metadata.EntryPoints."""
    def select(self, **kwargs):
        return _EmptyEntryPoints()
    @property
    def groups(self):
        return set()
    @property
    def names(self):
        return set()

_im.packages_distributions = lambda: {}
_im.entry_points = lambda **kwargs: _EmptyEntryPoints()
_im.distributions = lambda **kwargs: iter([])
# -------------------------------------------------------------------

from fastapi import FastAPI
from fastapi import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from app.routes import auth, bounty, dao, dashboard, submission
from app.config import API_ENV, API_HOST, API_PORT, CORS_ORIGINS, ENABLE_DOCS, TRUSTED_HOSTS
from app.readiness import run_readiness_checks

app = FastAPI(
    title="AlgoBounty API",
    docs_url="/docs" if ENABLE_DOCS else None,
    redoc_url="/redoc" if ENABLE_DOCS else None,
    openapi_url="/openapi.json" if ENABLE_DOCS else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=TRUSTED_HOSTS)


@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "same-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if API_ENV == "production":
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
    return response


@app.get("/api/health")
def read_root():
    return {"status": "ok", "message": "Python Backend is running"}


@app.get("/api/health/ready")
def readiness_check():
    checks = run_readiness_checks()
    if not all(check["ok"] for check in checks.values()):
        raise HTTPException(
            status_code=503,
            detail={
                "status": "error",
                "environment": API_ENV,
                "checks": checks,
            },
        )
    return {"status": "ok", "environment": API_ENV, "checks": checks}

# Register Routes
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(bounty.router, prefix="/api/bounty", tags=["Bounties"])
app.include_router(dao.router, prefix="/api/dao", tags=["DAO Governance"])
app.include_router(submission.router, prefix="/api/submission", tags=["Submissions"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=API_HOST, port=API_PORT)
