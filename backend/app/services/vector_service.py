
client = None
collection = None


def get_collection():
    global client, collection

    if collection is None:
        import chromadb

        client = chromadb.PersistentClient(
            path="data/chroma_db"
        )

        collection = client.get_or_create_collection(
            name="support_knowledge_base"
        )

    return collection


def add_document_chunk(
    chunk_id: str,
    text: str,
    embedding: list,
    metadata: dict
):
    collection = get_collection()

    collection.add(
        ids=[chunk_id],
        documents=[text],
        embeddings=[embedding],
        metadatas=[metadata]
    )


def search_documents(
    query_embedding: list,
    number_of_results: int = 3
):
    collection = get_collection()

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=number_of_results
    )

    return results
