/*
AST生成と解析
関数を返す
Go
*/
package analyzeFunc

import (
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"log"
	"os"
	"path/filepath"
)

// RunAnalyzeFunctions は AST解析を実行して関数一覧を出力します
func RunAnalyzeFunctions(filePath string) {
	// ファイルを読み込む
	sourceCode, err := os.ReadFile(filePath)
	if err != nil {
		log.Fatalf("Error reading file: %v", err)
	}

	// ASTを生成
	fset, node := generateAST(filePath, sourceCode)

	// ASTを解析して、定義されている関数一覧を取得
	functions := analyzeFunctions(fset, node)

	// 結果を出力
	fmt.Println("Defined Functions:", functions)

	// 実行ファイルのパスを取得
	execDir := filepath.Dir(os.Args[0])

	// ファイルに結果を出力
	outputFilePath := filepath.Join(execDir, "temp")
	file, err := os.Create(outputFilePath)
	if err != nil {
		log.Fatalf("Error creating output file: %v", err)
	}
	defer file.Close()

	// 結果をファイルに書き込む
	_, err = file.WriteString(fmt.Sprintf("%v\n", functions))
	if err != nil {
		log.Fatalf("Error writing to file: %v", err)
	}

	fmt.Printf("Results written to %s\n", outputFilePath)
}

// 以下は元の関数をそのまま移植
func generateAST(filePath string, sourceCode []byte) (*token.FileSet, *ast.File) {
	fset := token.NewFileSet()
	node, err := parser.ParseFile(fset, filePath, sourceCode, parser.AllErrors)
	if err != nil {
		log.Fatalf("Error parsing file: %v", err)
	}

	return fset, node
}

func analyzeFunctions(fset *token.FileSet, node *ast.File) []string {
	var functions []string
	ast.Inspect(node, func(n ast.Node) bool {
		if fn, ok := n.(*ast.FuncDecl); ok {
			functions = append(functions, fn.Name.Name)
		}
		return true
	})

	return functions
}
