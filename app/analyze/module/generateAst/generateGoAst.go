/*
AST生成
Go
*/
package main

import (
	"go/ast"
	"go/parser"
	"go/token"
	"io/ioutil"
	"log"
	"os"
)

func main() {
	if len(os.Args) < 2 {
		log.Fatalf("Usage: %s <file.go>", os.Args[0])
	}

	filePath := os.Args[1]

	// ファイルを読み込む
	sourceCode, err := ioutil.ReadFile(filePath)
	if err != nil {
		log.Fatalf("Error reading file: %v", err)
	}

	// ソースコードをパースする
	fset := token.NewFileSet()
	f, err := parser.ParseFile(fset, filePath, sourceCode, parser.AllErrors)
	if err != nil {
		log.Fatalf("Error parsing file: %v", err)
	}

	// ASTを出力する
	ast.Print(fset, f)
}
