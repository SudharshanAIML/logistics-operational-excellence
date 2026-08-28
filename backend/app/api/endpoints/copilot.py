from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from backend.app.db.database import get_db
from backend.app.services import copilot_agent

router = APIRouter()

@router.get("/ask")
def ask_copilot(
    query: str = Query(..., description="NLP operational query"),
    db: Session = Depends(get_db)
):
    """
    Passes a natural language query to the Ops Copilot semantic agent.
    """
    return copilot_agent.ask_ops_copilot(db, query)
