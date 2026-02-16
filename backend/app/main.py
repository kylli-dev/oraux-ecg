from fastapi import FastAPI

app = FastAPI(title="Oraux Platform")

@app.get("/health")
def health():
    return {"status": "ok"}
