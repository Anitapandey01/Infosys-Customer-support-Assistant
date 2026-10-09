from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.models.database import SessionLocal
from app.models.document import Document
from app.api.dependencies import require_support_access
from app.models.user import User
from app.services.pdf_service import extract_text_from_pdf
from pathlib import Path
from fastapi.responses import FileResponse

UPLOAD_DIR = Path(__file__).resolve().parents[2] / "data" / "documents"


router = APIRouter(
    prefix="/documents",
    tags=["Documents"]
)


# --------------------------------------------------
# Database dependency
# --------------------------------------------------

def get_db():

    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()


# --------------------------------------------------
# Get all uploaded documents
# --------------------------------------------------

@router.get("/")
def get_all_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_support_access)
):

    documents = (
        db.query(Document)
        .order_by(
            Document.document_name,
            Document.version.desc()
        )
        .all()
    )

    return {
        "total_documents": len(documents),
        "documents": [
            {
                "document_id": document.id,
                "document_name": document.document_name,
                "document_type": document.document_type,
                "version": document.version,
                "status": document.status,
                "filename": document.filename,
                "uploaded_by": document.uploaded_by
            }
            for document in documents
        ]
    }


# --------------------------------------------------
# Read actual document content
# --------------------------------------------------

@router.get("/content/{document_id}")
def get_document_content(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_support_access)
):

    document = db.query(Document).filter(Document.id == document_id).first()

    if not document:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Document not found.")

    file_path = UPLOAD_DIR / document.filename

    if not file_path.exists():
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Document file not found on the server.")

    try:
        pages = extract_text_from_pdf(str(file_path))
    except Exception as exc:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=f"Unable to read PDF: {exc}")

    return {
        "document_id": document.id,
        "document_name": document.document_name,
        "filename": document.filename,
        "document_type": document.document_type,
        "version": document.version,
        "uploaded_by": document.uploaded_by,
        "pages": [
            {
                "page_number": page["page_number"],
                "text": page["text"]
            }
            for page in pages
            if page.get("text")
        ]
    }


# --------------------------------------------------
# Serve the original PDF for authorized read-only viewing
# --------------------------------------------------

@router.get("/file/{document_id}")
def get_document_file(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_support_access)
):

    document = db.query(Document).filter(Document.id == document_id).first()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found.")

    file_path = UPLOAD_DIR / document.filename

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Document file not found on the server.")

    return FileResponse(
        path=str(file_path),
        media_type="application/pdf",
        filename=document.filename,
        content_disposition_type="inline"
    )


# --------------------------------------------------
# Get version history of a document
# --------------------------------------------------

@router.get("/history/{document_name}")
def get_document_history(
    document_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_support_access)
):

    documents = (
        db.query(Document)
        .filter(
            Document.document_name == document_name
        )
        .order_by(
            Document.version.desc()
        )
        .all()
    )

    return {
        "document_name": document_name,
        "total_versions": len(documents),
        "versions": [
            {
                "document_id": document.id,
                "version": document.version,
                "status": document.status,
                "filename": document.filename,
                "document_type": document.document_type,
                "uploaded_by": document.uploaded_by
            }
            for document in documents
        ]
    }