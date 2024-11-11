/*
AST生成と解析
Go
*/
package main

import (
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"io/ioutil"
	"log"
	"os"
	"strings"
)

/*
archive,
compress,
crypto,
database,
debug,
encoding,
go,
hash,
html,
image,
internal,
io,
log,
math,
mime,
net,
os,
path,
reflect,
runtime,
sync,
testing,
text,
vendor
*/
/*
args:
filePath,
target module

do:
genarate AST
import module analyze
*/

func main() {
	if len(os.Args) < 3 {
		log.Fatalf("Usage: %s <file.go> <module_name>", os.Args[0])
	}

	filePath := os.Args[1]
	targetModule := os.Args[2]

	// ファイルを読み込む
	sourceCode, err := ioutil.ReadFile(filePath)
	if err != nil {
		log.Fatalf("Error reading file: %v", err)
	}

	// ASTを生成
	fset, node := generateAST(filePath, sourceCode)

	// ASTを解析して、モジュールがインポートされ利用されているかを確認
	isImportedAndUsed := analyzeAST(fset, node, targetModule)

	// 結果を出力
	if isImportedAndUsed {
		fmt.Printf("Module '%s' is imported and used.\n", targetModule)
	} else {
		fmt.Printf("Module '%s' is either not imported or not used.\n", targetModule)
	}
}

// ASTを生成する関数
func generateAST(filePath string, sourceCode []byte) (*token.FileSet, *ast.File) {
	// ソースコードをパースする
	fset := token.NewFileSet()
	node, err := parser.ParseFile(fset, filePath, sourceCode, parser.AllErrors)
	if err != nil {
		log.Fatalf("Error parsing file: %v", err)
	}

	// ASTを出力する
	ast.Print(fset, node)
	return fset, node
}

// ASTを解析する関数
func analyzeAST(fset *token.FileSet, node *ast.File, targetModule string) bool {
	// インポートされたパッケージを収集
	imports := make(map[string]bool)
	ast.Inspect(node, func(n ast.Node) bool {
		// ImportSpecノードを見つけてimportされたパッケージを記録
		if imp, ok := n.(*ast.ImportSpec); ok {
			// パッケージ名を取り出すためにパスをスラッシュで分割し，最後の要素を使用
			fullPath := strings.Trim(imp.Path.Value, `"`)
			segments := strings.Split(fullPath, "/")
			packageName := segments[len(segments)-1]
			imports[packageName] = false
		}
		return true
	})

	// ASTを解析してSelectorExprを見つけ、使用されているインポートをチェック
	ast.Inspect(node, func(n ast.Node) bool {
		if sel, ok := n.(*ast.SelectorExpr); ok {
			if ident, ok := sel.X.(*ast.Ident); ok {
				// ident.Nameはパッケージ名を表しているので、マップに存在すれば利用フラグをtrueにする
				if _, exists := imports[ident.Name]; exists {
					imports[ident.Name] = true
				}
			}
		}
		return true
	})

	// 指定されたモジュールがインポートされ、かつ利用されているかをチェック
	if used, imported := imports[targetModule]; imported && used {
		return true
	}

	return false
}
