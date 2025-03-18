from llama_index import VectorStoreIndex, SimpleDirectoryReader
from llama_index.retrievers import VectorIndexRetriever
from llama_index.query_engine import RetrieverQueryEngine

# ドキュメントの読み込みとインデックス化
documents = SimpleDirectoryReader('path_to_documents').load_data()
index = VectorStoreIndex.from_documents(documents)

# リトリーバーの設定
retriever = VectorIndexRetriever(index=index, similarity_top_k=2)

# クエリエンジンの設定
query_engine = RetrieverQueryEngine(retriever=retriever)

# 関連情報の取得
query = "gRPC関連のバグ修正に必要な情報"
relevant_docs = query_engine.query(query)

# LLMへのリクエスト
prompt = f"""
## Instruction ##
You are tasked with identifying and fixing gRPC-related issues in the source code based on the provided proto file and the given differences.

### What you should do:
- Analyze the "### proto file ###" to ensure all message and service definitions are correctly implemented in the "### source code ###".
- Use the given changes in "### difference of changes ###" as a **hint**, but do not assume they are fully correct.
- Correct any type mismatches, field names, or methods based on the proto file.
- Identify potential errors **beyond** the given changes if necessary.
- Handle exceptions properly based on the updated proto file structure.
- Output only the corrected source code with no additional explanations.

---

## Context ##

### Proto file ###
{relevant_docs['proto_file']}

### Dependency Tree of Proto ###
{relevant_docs['dependency_tree']}

### Difference of Proto File Changes ###
{relevant_docs['proto_file_changes']}

### Difference of Changes (Issue/Pull Request) ###
{relevant_docs['file_changes']}

### Source Code (Before Fix) ###
{relevant_docs['source_code']}

---

## **Your Task**:
1. Use the provided proto file and its dependency tree to understand the overall structure.
2. Analyze the changes in "difference of changes" and "difference of proto file changes" to identify what **might** have caused the bug.
3. **Do not blindly trust the given changes**—verify their correctness and modify them as needed.
4. Provide only the corrected source code as output.
"""

# LLMにリクエストを送信
response = llm_request(prompt)
print(response)