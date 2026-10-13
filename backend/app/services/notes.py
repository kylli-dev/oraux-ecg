"""Règles communes de saisie des notes."""
from __future__ import annotations

from typing import Optional

from fastapi import HTTPException


def verifier_note(valeur: Optional[float], libelle: str = "La note") -> None:
    """
    Une note va de 0 à 20 et se saisit au centième près (deux décimales au plus).
    Elle n'est JAMAIS arrondie : une valeur plus précise est refusée, pour que la note
    enregistrée soit exactement celle saisie.
    """
    if valeur is None:
        return
    if not (0 <= valeur <= 20):
        raise HTTPException(status_code=422, detail=f"{libelle} doit être comprise entre 0 et 20")
    centiemes = valeur * 100
    if abs(centiemes - round(centiemes)) > 1e-6:
        raise HTTPException(
            status_code=422,
            detail=f"{libelle} ne peut pas avoir plus de deux décimales (au centième près, ex. 14,25)",
        )
