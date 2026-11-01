from fastapi import APIRouter, HTTPException, Depends
from app.db import supabase
from app.auth import get_current_user
from app.bounty_status import sync_bounty_state

router = APIRouter()


@router.get("/my-bounties")
def get_dashboard_bounties(current_user: str = Depends(get_current_user)):
    try:
        # Fetch the authenticated creator's bounties from Supabase
        res = supabase.table('bounties').select('*').eq('creator', current_user).order('createdAt', desc=True).execute()
        
        bounties = []
        for doc in res.data:
            doc = sync_bounty_state(doc)
            # Strip secret key!
            if 'escrowSecret' in doc:
                del doc['escrowSecret']
            bounties.append(doc)
            
        return {"success": True, "data": bounties}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Dashboard error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
