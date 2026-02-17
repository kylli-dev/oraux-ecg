from datetime import date
from pydantic import BaseModel, Field

class ApplyJourneeTypeIn(BaseModel):
    journee_type_id: int = Field(ge=1)
    date: date
