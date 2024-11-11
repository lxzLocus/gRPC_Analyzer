/*
AST生成と解析
Go
*/
package main

import (
	"bufio"
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

// protoファイルからパッケージ名を取得
func findProtoPackageName(filePath string) (string, error) {
	// ファイルを開く
	file, err := os.Open(filePath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	// ファイルを1行ずつ読み込む
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Text()

		// "package" キーワードが含まれる行を探す
		if strings.HasPrefix(strings.TrimSpace(line), "package") {
			// "package" の後に続く名前を取得
			parts := strings.Fields(line)
			if len(parts) > 1 {
				return parts[1], nil
			}
		}
	}

	// エラーが発生した場合、またはパッケージ名が見つからなかった場合
	if err := scanner.Err(); err != nil {
		return "", err
	}
	return "", fmt.Errorf("package name not found in %s", filePath)
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
