from fastapi import APIRouter


router = APIRouter()


@router.get("/")
async def root():
    return {"message": "XRAYAPP Backend API", "status": "running"}

