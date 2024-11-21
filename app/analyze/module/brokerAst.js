/*
AST Broker
*/
/*import module*/
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const { exec } = require('child_process');

const { analyzeGoAst } = require('./analyzeAst/goAst');


/*config*/
const allowedExtensions = {
    '.go': 'go',         // Go
    '.cs': 'csharp',     // C#
    '.java': 'java',     // Java
    '.scala': 'scala',   // Scala
    '.ts': 'typescript', // TypeScript
    '.py': 'python',     // Python
    '.c': 'c',           // C
    '.js': 'javascript', // JavaScript
    '.sh': 'shell',      // Shell
    '.html': 'html',     // HTML
    '.htm': 'html',      // HTML (alternative extension)
    '.css': 'css',       // CSS
    '.pl': 'perl',       // Perl
    '.pm': 'perl',       // Perl module
    '.cpp': 'cpp',       // C++
    '.cc': 'cpp',        // C++
    '.cx': 'cpp',        // C++
    '.rs': 'rust',       // Rust
    '.proto': 'proto',  //Proto
};


/*__MAIN__*/
if (require.main === module) {
    // let mergeStateFilePath = process.argv.slice(2)[0];
    let protoPathMap = new Map([
        [
            "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/golang/protobuf/ptypes/any/any.proto",
            {
                package: "google.protobuf",
                options: [
                    { key: "csharp_namespace", value: "Google.Protobuf.WellKnownTypes" },
                    { key: "go_package", value: "github.com/golang/protobuf/ptypes/any" },
                    { key: "java_package", value: "com.google.protobuf" },
                    { key: "java_outer_classname", value: "AnyProto" },
                    { key: "java_multiple_files", value: "true" },
                    { key: "objc_class_prefix", value: "GPB" },
                ],
            },
        ],
        [
            "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/golang/protobuf/ptypes/duration/duration.proto",
            {
                package: "google.protobuf",
                options: [
                    {
                        key: "csharp_namespace",
                        value: "Google.Protobuf.WellKnownTypes",
                    },
                    {
                        key: "cc_enable_arenas",
                        value: "true",
                    },
                    {
                        key: "go_package",
                        value: "github.com/golang/protobuf/ptypes/duration",
                    },
                    {
                        key: "java_package",
                        value: "com.google.protobuf",
                    },
                    {
                        key: "java_outer_classname",
                        value: "DurationProto",
                    },
                    {
                        key: "java_multiple_files",
                        value: "true",
                    },
                    {
                        key: "objc_class_prefix",
                        value: "GPB",
                    },
                ],
            },
        ],
        [
            "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/golang/protobuf/ptypes/timestamp/timestamp.proto",
            {
                package: "google.protobuf",
                options: [
                    {
                        key: "csharp_namespace",
                        value: "Google.Protobuf.WellKnownTypes",
                    },
                    {
                        key: "cc_enable_arenas",
                        value: "true",
                    },
                    {
                        key: "go_package",
                        value: "github.com/golang/protobuf/ptypes/timestamp",
                    },
                    {
                        key: "java_package",
                        value: "com.google.protobuf",
                    },
                    {
                        key: "java_outer_classname",
                        value: "TimestampProto",
                    },
                    {
                        key: "java_multiple_files",
                        value: "true",
                    },
                    {
                        key: "objc_class_prefix",
                        value: "GPB",
                    },
                ],
            },
        ],
        [
            "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/admissionregistration/v1beta1/generated.proto",
            {
                package: "k8s.io.api.admissionregistration.v1beta1",
                options: [
                    {
                        key: "go_package",
                        value: "v1beta1",
                    },
                ],
            },
        ],
        [
            "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fortune/api/fortune.proto",
            {
                package: "api",
                options: [
                ],
            },
        ]
    ]);
    let programFileList = [
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/doggos/main.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/emoji/main.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/emoji/pkg/emoji/emoji.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/main.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/ghodss/yaml/fields.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/ghodss/yaml/yaml.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/gogo/protobuf/proto/clone.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/gogo/protobuf/proto/custom_gogo.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/gogo/protobuf/proto/decode.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/gogo/protobuf/proto/discard.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/gogo/protobuf/proto/duration.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/gogo/protobuf/proto/duration_gogo.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/gogo/protobuf/proto/encode.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/gogo/protobuf/proto/encode_gogo.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/gogo/protobuf/proto/equal.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/gogo/protobuf/proto/extensions.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/gogo/protobuf/proto/extensions_gogo.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/gogo/protobuf/proto/lib.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/gogo/protobuf/proto/lib_gogo.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/gogo/protobuf/proto/message_set.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/gogo/protobuf/proto/pointer_reflect.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/gogo/protobuf/proto/pointer_reflect_gogo.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/gogo/protobuf/proto/pointer_unsafe.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/gogo/protobuf/proto/pointer_unsafe_gogo.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/gogo/protobuf/proto/properties.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/gogo/protobuf/proto/properties_gogo.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/gogo/protobuf/proto/skip_gogo.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/gogo/protobuf/proto/table_marshal.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/gogo/protobuf/proto/table_marshal_gogo.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/gogo/protobuf/proto/table_merge.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/gogo/protobuf/proto/table_unmarshal.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/gogo/protobuf/proto/table_unmarshal_gogo.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/gogo/protobuf/proto/text.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/gogo/protobuf/proto/text_gogo.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/gogo/protobuf/proto/text_parser.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/gogo/protobuf/proto/timestamp.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/gogo/protobuf/proto/timestamp_gogo.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/gogo/protobuf/sortkeys/sortkeys.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/golang/glog/glog.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/golang/glog/glog_file.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/golang/protobuf/proto/clone.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/golang/protobuf/proto/decode.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/golang/protobuf/proto/discard.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/golang/protobuf/proto/encode.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/golang/protobuf/proto/equal.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/golang/protobuf/proto/extensions.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/golang/protobuf/proto/lib.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/golang/protobuf/proto/message_set.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/golang/protobuf/proto/pointer_reflect.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/golang/protobuf/proto/pointer_unsafe.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/golang/protobuf/proto/properties.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/golang/protobuf/proto/table_marshal.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/golang/protobuf/proto/table_merge.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/golang/protobuf/proto/table_unmarshal.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/golang/protobuf/proto/text.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/golang/protobuf/proto/text_parser.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/golang/protobuf/ptypes/any/any.pb.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/golang/protobuf/ptypes/any.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/golang/protobuf/ptypes/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/golang/protobuf/ptypes/duration/duration.pb.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/golang/protobuf/ptypes/duration.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/golang/protobuf/ptypes/timestamp/timestamp.pb.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/golang/protobuf/ptypes/timestamp.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/google/btree/btree.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/google/btree/btree_mem.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/google/gofuzz/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/google/gofuzz/fuzz.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/googleapis/gnostic/OpenAPIv2/OpenAPIv2.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/googleapis/gnostic/OpenAPIv2/OpenAPIv2.pb.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/googleapis/gnostic/compiler/context.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/googleapis/gnostic/compiler/error.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/googleapis/gnostic/compiler/extension-handler.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/googleapis/gnostic/compiler/helpers.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/googleapis/gnostic/compiler/main.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/googleapis/gnostic/compiler/reader.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/googleapis/gnostic/extensions/COMPILE-EXTENSION.sh",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/googleapis/gnostic/extensions/extension.pb.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/googleapis/gnostic/extensions/extensions.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/gorilla/context/context.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/gorilla/context/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/gorilla/mux/context_gorilla.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/gorilla/mux/context_native.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/gorilla/mux/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/gorilla/mux/middleware.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/gorilla/mux/mux.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/gorilla/mux/regexp.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/gorilla/mux/route.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/gorilla/mux/test_helpers.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/gregjones/httpcache/diskcache/diskcache.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/gregjones/httpcache/httpcache.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/json-iterator/go/adapter.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/json-iterator/go/any.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/json-iterator/go/any_array.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/json-iterator/go/any_bool.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/json-iterator/go/any_float.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/json-iterator/go/any_int32.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/json-iterator/go/any_int64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/json-iterator/go/any_invalid.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/json-iterator/go/any_nil.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/json-iterator/go/any_number.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/json-iterator/go/any_object.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/json-iterator/go/any_str.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/json-iterator/go/any_uint32.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/json-iterator/go/any_uint64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/json-iterator/go/build.sh",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/json-iterator/go/config.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/json-iterator/go/iter.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/json-iterator/go/iter_array.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/json-iterator/go/iter_float.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/json-iterator/go/iter_int.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/json-iterator/go/iter_object.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/json-iterator/go/iter_skip.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/json-iterator/go/iter_skip_sloppy.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/json-iterator/go/iter_skip_strict.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/json-iterator/go/iter_str.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/json-iterator/go/jsoniter.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/json-iterator/go/pool.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/json-iterator/go/reflect.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/json-iterator/go/reflect_array.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/json-iterator/go/reflect_dynamic.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/json-iterator/go/reflect_extension.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/json-iterator/go/reflect_json_number.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/json-iterator/go/reflect_json_raw_message.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/json-iterator/go/reflect_map.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/json-iterator/go/reflect_marshaler.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/json-iterator/go/reflect_native.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/json-iterator/go/reflect_optional.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/json-iterator/go/reflect_slice.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/json-iterator/go/reflect_struct_decoder.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/json-iterator/go/reflect_struct_encoder.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/json-iterator/go/stream.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/json-iterator/go/stream_float.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/json-iterator/go/stream_int.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/json-iterator/go/stream_str.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/json-iterator/go/test.sh",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/modern-go/concurrent/executor.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/modern-go/concurrent/go_above_19.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/modern-go/concurrent/go_below_19.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/modern-go/concurrent/log.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/modern-go/concurrent/test.sh",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/modern-go/concurrent/unbounded_executor.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/modern-go/reflect2/go_above_17.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/modern-go/reflect2/go_above_19.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/modern-go/reflect2/go_below_17.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/modern-go/reflect2/go_below_19.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/modern-go/reflect2/reflect2.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/modern-go/reflect2/reflect2_kind.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/modern-go/reflect2/safe_field.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/modern-go/reflect2/safe_map.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/modern-go/reflect2/safe_slice.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/modern-go/reflect2/safe_struct.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/modern-go/reflect2/safe_type.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/modern-go/reflect2/test.sh",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/modern-go/reflect2/type_map.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/modern-go/reflect2/unsafe_array.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/modern-go/reflect2/unsafe_eface.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/modern-go/reflect2/unsafe_field.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/modern-go/reflect2/unsafe_iface.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/modern-go/reflect2/unsafe_link.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/modern-go/reflect2/unsafe_map.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/modern-go/reflect2/unsafe_ptr.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/modern-go/reflect2/unsafe_slice.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/modern-go/reflect2/unsafe_struct.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/modern-go/reflect2/unsafe_type.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/petar/GoLLRB/llrb/avgvar.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/petar/GoLLRB/llrb/iterator.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/petar/GoLLRB/llrb/llrb-stats.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/petar/GoLLRB/llrb/llrb.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/petar/GoLLRB/llrb/util.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/peterbourgon/diskv/compression.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/peterbourgon/diskv/diskv.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/github.com/peterbourgon/diskv/index.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/crypto/ssh/terminal/terminal.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/crypto/ssh/terminal/util.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/crypto/ssh/terminal/util_bsd.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/crypto/ssh/terminal/util_linux.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/crypto/ssh/terminal/util_plan9.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/crypto/ssh/terminal/util_solaris.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/crypto/ssh/terminal/util_windows.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/net/context/context.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/net/context/go17.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/net/context/go19.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/net/context/pre_go17.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/net/context/pre_go19.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/net/http/httpguts/guts.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/net/http/httpguts/httplex.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/net/http2/ciphers.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/net/http2/client_conn_pool.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/net/http2/configure_transport.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/net/http2/databuffer.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/net/http2/errors.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/net/http2/flow.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/net/http2/frame.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/net/http2/go111.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/net/http2/go16.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/net/http2/go17.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/net/http2/go17_not18.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/net/http2/go18.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/net/http2/go19.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/net/http2/gotrack.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/net/http2/headermap.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/net/http2/hpack/encode.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/net/http2/hpack/hpack.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/net/http2/hpack/huffman.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/net/http2/hpack/tables.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/net/http2/http2.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/net/http2/not_go111.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/net/http2/not_go16.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/net/http2/not_go17.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/net/http2/not_go18.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/net/http2/not_go19.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/net/http2/pipe.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/net/http2/server.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/net/http2/transport.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/net/http2/write.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/net/http2/writesched.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/net/http2/writesched_priority.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/net/http2/writesched_random.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/net/idna/idna.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/net/idna/punycode.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/net/idna/tables.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/net/idna/trie.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/net/idna/trieval.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/affinity_linux.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/aliases.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/bluetooth_linux.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/cap_freebsd.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/constants.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/dev_darwin.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/dev_dragonfly.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/dev_freebsd.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/dev_linux.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/dev_netbsd.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/dev_openbsd.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/dirent.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/endian_big.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/endian_little.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/env_unix.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/errors_freebsd_386.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/errors_freebsd_amd64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/errors_freebsd_arm.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/fcntl.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/fcntl_linux_32bit.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/gccgo.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/gccgo_c.c",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/gccgo_linux_amd64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/ioctl.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/mkall.sh",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/mkerrors.sh",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/mkpost.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/mksyscall.pl",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/mksyscall_solaris.pl",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/mksysctl_openbsd.pl",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/mksysnum_darwin.pl",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/mksysnum_dragonfly.pl",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/mksysnum_freebsd.pl",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/mksysnum_netbsd.pl",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/mksysnum_openbsd.pl",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/openbsd_pledge.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/pagesize_unix.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/race.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/race0.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/sockcmsg_linux.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/sockcmsg_unix.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/str.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/syscall.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/syscall_bsd.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/syscall_darwin.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/syscall_darwin_386.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/syscall_darwin_amd64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/syscall_darwin_arm.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/syscall_darwin_arm64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/syscall_dragonfly.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/syscall_dragonfly_amd64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/syscall_freebsd.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/syscall_freebsd_386.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/syscall_freebsd_amd64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/syscall_freebsd_arm.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/syscall_linux.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/syscall_linux_386.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/syscall_linux_amd64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/syscall_linux_amd64_gc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/syscall_linux_arm.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/syscall_linux_arm64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/syscall_linux_gc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/syscall_linux_gc_386.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/syscall_linux_gccgo_386.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/syscall_linux_gccgo_arm.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/syscall_linux_mips64x.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/syscall_linux_mipsx.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/syscall_linux_ppc64x.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/syscall_linux_s390x.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/syscall_linux_sparc64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/syscall_netbsd.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/syscall_netbsd_386.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/syscall_netbsd_amd64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/syscall_netbsd_arm.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/syscall_openbsd.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/syscall_openbsd_386.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/syscall_openbsd_amd64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/syscall_openbsd_arm.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/syscall_solaris.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/syscall_solaris_amd64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/syscall_unix.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/syscall_unix_gc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/timestruct.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/types_darwin.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/types_dragonfly.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/types_freebsd.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/types_netbsd.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/types_openbsd.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/types_solaris.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/xattr_bsd.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zerrors_darwin_386.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zerrors_darwin_amd64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zerrors_darwin_arm.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zerrors_darwin_arm64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zerrors_dragonfly_amd64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zerrors_freebsd_386.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zerrors_freebsd_amd64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zerrors_freebsd_arm.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zerrors_linux_386.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zerrors_linux_amd64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zerrors_linux_arm.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zerrors_linux_arm64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zerrors_linux_mips.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zerrors_linux_mips64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zerrors_linux_mips64le.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zerrors_linux_mipsle.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zerrors_linux_ppc64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zerrors_linux_ppc64le.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zerrors_linux_s390x.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zerrors_linux_sparc64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zerrors_netbsd_386.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zerrors_netbsd_amd64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zerrors_netbsd_arm.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zerrors_openbsd_386.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zerrors_openbsd_amd64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zerrors_openbsd_arm.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zerrors_solaris_amd64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zptrace386_linux.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zptracearm_linux.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zptracemips_linux.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zptracemipsle_linux.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsyscall_darwin_386.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsyscall_darwin_amd64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsyscall_darwin_arm.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsyscall_darwin_arm64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsyscall_dragonfly_amd64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsyscall_freebsd_386.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsyscall_freebsd_amd64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsyscall_freebsd_arm.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsyscall_linux_386.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsyscall_linux_amd64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsyscall_linux_arm.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsyscall_linux_arm64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsyscall_linux_mips.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsyscall_linux_mips64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsyscall_linux_mips64le.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsyscall_linux_mipsle.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsyscall_linux_ppc64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsyscall_linux_ppc64le.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsyscall_linux_s390x.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsyscall_linux_sparc64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsyscall_netbsd_386.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsyscall_netbsd_amd64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsyscall_netbsd_arm.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsyscall_openbsd_386.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsyscall_openbsd_amd64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsyscall_openbsd_arm.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsyscall_solaris_amd64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsysctl_openbsd_386.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsysctl_openbsd_amd64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsysctl_openbsd_arm.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsysnum_darwin_386.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsysnum_darwin_amd64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsysnum_darwin_arm.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsysnum_darwin_arm64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsysnum_dragonfly_amd64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsysnum_freebsd_386.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsysnum_freebsd_amd64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsysnum_freebsd_arm.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsysnum_linux_386.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsysnum_linux_amd64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsysnum_linux_arm.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsysnum_linux_arm64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsysnum_linux_mips.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsysnum_linux_mips64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsysnum_linux_mips64le.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsysnum_linux_mipsle.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsysnum_linux_ppc64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsysnum_linux_ppc64le.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsysnum_linux_s390x.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsysnum_linux_sparc64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsysnum_netbsd_386.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsysnum_netbsd_amd64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsysnum_netbsd_arm.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsysnum_openbsd_386.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsysnum_openbsd_amd64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/zsysnum_openbsd_arm.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/ztypes_darwin_386.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/ztypes_darwin_amd64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/ztypes_darwin_arm.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/ztypes_darwin_arm64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/ztypes_dragonfly_amd64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/ztypes_freebsd_386.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/ztypes_freebsd_amd64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/ztypes_freebsd_arm.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/ztypes_linux_386.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/ztypes_linux_amd64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/ztypes_linux_arm.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/ztypes_linux_arm64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/ztypes_linux_mips.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/ztypes_linux_mips64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/ztypes_linux_mips64le.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/ztypes_linux_mipsle.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/ztypes_linux_ppc64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/ztypes_linux_ppc64le.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/ztypes_linux_s390x.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/ztypes_linux_sparc64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/ztypes_netbsd_386.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/ztypes_netbsd_amd64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/ztypes_netbsd_arm.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/ztypes_openbsd_386.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/ztypes_openbsd_amd64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/ztypes_openbsd_arm.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/unix/ztypes_solaris_amd64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/windows/aliases.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/windows/dll_windows.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/windows/env_windows.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/windows/eventlog.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/windows/exec_windows.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/windows/memory_windows.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/windows/mksyscall.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/windows/race.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/windows/race0.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/windows/security_windows.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/windows/service.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/windows/str.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/windows/syscall.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/windows/syscall_windows.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/windows/types_windows.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/windows/types_windows_386.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/windows/types_windows_amd64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/sys/windows/zsyscall_windows.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/collate/build/builder.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/collate/build/colelem.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/collate/build/contract.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/collate/build/order.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/collate/build/table.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/collate/build/trie.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/collate/collate.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/collate/index.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/collate/maketables.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/collate/option.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/collate/sort.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/collate/tables.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/internal/colltab/collelem.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/internal/colltab/colltab.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/internal/colltab/contract.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/internal/colltab/iter.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/internal/colltab/numeric.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/internal/colltab/table.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/internal/colltab/trie.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/internal/colltab/weighter.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/internal/gen/code.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/internal/gen/gen.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/internal/tag/tag.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/internal/triegen/compact.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/internal/triegen/print.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/internal/triegen/triegen.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/internal/ucd/ucd.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/language/common.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/language/coverage.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/language/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/language/gen.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/language/gen_common.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/language/gen_index.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/language/go1_1.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/language/go1_2.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/language/index.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/language/language.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/language/lookup.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/language/match.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/language/parse.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/language/tables.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/language/tags.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/secure/bidirule/bidirule.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/secure/bidirule/bidirule10.0.0.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/secure/bidirule/bidirule9.0.0.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/transform/transform.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/unicode/bidi/bidi.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/unicode/bidi/bracket.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/unicode/bidi/core.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/unicode/bidi/gen.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/unicode/bidi/gen_ranges.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/unicode/bidi/gen_trieval.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/unicode/bidi/prop.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/unicode/bidi/tables10.0.0.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/unicode/bidi/tables9.0.0.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/unicode/bidi/trieval.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/unicode/cldr/base.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/unicode/cldr/cldr.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/unicode/cldr/collate.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/unicode/cldr/decode.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/unicode/cldr/makexml.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/unicode/cldr/resolve.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/unicode/cldr/slice.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/unicode/cldr/xml.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/unicode/norm/composition.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/unicode/norm/forminfo.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/unicode/norm/input.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/unicode/norm/iter.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/unicode/norm/maketables.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/unicode/norm/normalize.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/unicode/norm/readwriter.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/unicode/norm/tables10.0.0.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/unicode/norm/tables9.0.0.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/unicode/norm/transform.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/unicode/norm/trie.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/unicode/norm/triegen.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/unicode/rangetable/gen.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/unicode/rangetable/merge.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/unicode/rangetable/rangetable.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/unicode/rangetable/tables10.0.0.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/text/unicode/rangetable/tables9.0.0.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/time/rate/rate.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/time/rate/rate_go16.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/golang.org/x/time/rate/rate_go17.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/gopkg.in/inf.v0/dec.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/gopkg.in/inf.v0/rounder.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/gopkg.in/yaml.v2/apic.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/gopkg.in/yaml.v2/decode.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/gopkg.in/yaml.v2/emitterc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/gopkg.in/yaml.v2/encode.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/gopkg.in/yaml.v2/parserc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/gopkg.in/yaml.v2/readerc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/gopkg.in/yaml.v2/resolve.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/gopkg.in/yaml.v2/scannerc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/gopkg.in/yaml.v2/sorter.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/gopkg.in/yaml.v2/writerc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/gopkg.in/yaml.v2/yaml.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/gopkg.in/yaml.v2/yamlh.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/gopkg.in/yaml.v2/yamlprivateh.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/admissionregistration/v1alpha1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/admissionregistration/v1alpha1/generated.pb.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/admissionregistration/v1alpha1/register.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/admissionregistration/v1alpha1/types.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/admissionregistration/v1alpha1/types_swagger_doc_generated.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/admissionregistration/v1alpha1/zz_generated.deepcopy.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/admissionregistration/v1beta1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/admissionregistration/v1beta1/generated.pb.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/admissionregistration/v1beta1/register.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/admissionregistration/v1beta1/types.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/admissionregistration/v1beta1/types_swagger_doc_generated.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/admissionregistration/v1beta1/zz_generated.deepcopy.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/apps/v1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/apps/v1/generated.pb.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/apps/v1/register.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/apps/v1/types.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/apps/v1/types_swagger_doc_generated.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/apps/v1/zz_generated.deepcopy.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/apps/v1beta1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/apps/v1beta1/generated.pb.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/apps/v1beta1/register.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/apps/v1beta1/types.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/apps/v1beta1/types_swagger_doc_generated.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/apps/v1beta1/zz_generated.deepcopy.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/apps/v1beta2/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/apps/v1beta2/generated.pb.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/apps/v1beta2/register.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/apps/v1beta2/types.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/apps/v1beta2/types_swagger_doc_generated.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/apps/v1beta2/zz_generated.deepcopy.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/authentication/v1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/authentication/v1/generated.pb.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/authentication/v1/register.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/authentication/v1/types.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/authentication/v1/types_swagger_doc_generated.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/authentication/v1/zz_generated.deepcopy.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/authentication/v1beta1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/authentication/v1beta1/generated.pb.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/authentication/v1beta1/register.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/authentication/v1beta1/types.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/authentication/v1beta1/types_swagger_doc_generated.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/authentication/v1beta1/zz_generated.deepcopy.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/authorization/v1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/authorization/v1/generated.pb.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/authorization/v1/register.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/authorization/v1/types.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/authorization/v1/types_swagger_doc_generated.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/authorization/v1/zz_generated.deepcopy.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/authorization/v1beta1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/authorization/v1beta1/generated.pb.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/authorization/v1beta1/register.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/authorization/v1beta1/types.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/authorization/v1beta1/types_swagger_doc_generated.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/authorization/v1beta1/zz_generated.deepcopy.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/autoscaling/v1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/autoscaling/v1/generated.pb.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/autoscaling/v1/register.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/autoscaling/v1/types.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/autoscaling/v1/types_swagger_doc_generated.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/autoscaling/v1/zz_generated.deepcopy.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/autoscaling/v2beta1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/autoscaling/v2beta1/generated.pb.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/autoscaling/v2beta1/register.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/autoscaling/v2beta1/types.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/autoscaling/v2beta1/types_swagger_doc_generated.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/autoscaling/v2beta1/zz_generated.deepcopy.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/batch/v1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/batch/v1/generated.pb.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/batch/v1/register.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/batch/v1/types.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/batch/v1/types_swagger_doc_generated.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/batch/v1/zz_generated.deepcopy.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/batch/v1beta1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/batch/v1beta1/generated.pb.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/batch/v1beta1/register.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/batch/v1beta1/types.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/batch/v1beta1/types_swagger_doc_generated.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/batch/v1beta1/zz_generated.deepcopy.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/batch/v2alpha1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/batch/v2alpha1/generated.pb.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/batch/v2alpha1/register.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/batch/v2alpha1/types.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/batch/v2alpha1/types_swagger_doc_generated.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/batch/v2alpha1/zz_generated.deepcopy.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/certificates/v1beta1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/certificates/v1beta1/generated.pb.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/certificates/v1beta1/register.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/certificates/v1beta1/types.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/certificates/v1beta1/types_swagger_doc_generated.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/certificates/v1beta1/zz_generated.deepcopy.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/core/v1/annotation_key_constants.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/core/v1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/core/v1/generated.pb.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/core/v1/objectreference.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/core/v1/register.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/core/v1/resource.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/core/v1/taint.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/core/v1/toleration.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/core/v1/types.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/core/v1/types_swagger_doc_generated.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/core/v1/zz_generated.deepcopy.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/events/v1beta1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/events/v1beta1/generated.pb.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/events/v1beta1/register.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/events/v1beta1/types.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/events/v1beta1/types_swagger_doc_generated.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/events/v1beta1/zz_generated.deepcopy.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/extensions/v1beta1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/extensions/v1beta1/generated.pb.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/extensions/v1beta1/register.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/extensions/v1beta1/types.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/extensions/v1beta1/types_swagger_doc_generated.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/extensions/v1beta1/zz_generated.deepcopy.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/networking/v1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/networking/v1/generated.pb.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/networking/v1/register.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/networking/v1/types.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/networking/v1/types_swagger_doc_generated.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/networking/v1/zz_generated.deepcopy.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/policy/v1beta1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/policy/v1beta1/generated.pb.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/policy/v1beta1/register.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/policy/v1beta1/types.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/policy/v1beta1/types_swagger_doc_generated.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/policy/v1beta1/zz_generated.deepcopy.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/rbac/v1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/rbac/v1/generated.pb.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/rbac/v1/register.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/rbac/v1/types.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/rbac/v1/types_swagger_doc_generated.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/rbac/v1/zz_generated.deepcopy.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/rbac/v1alpha1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/rbac/v1alpha1/generated.pb.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/rbac/v1alpha1/register.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/rbac/v1alpha1/types.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/rbac/v1alpha1/types_swagger_doc_generated.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/rbac/v1alpha1/zz_generated.deepcopy.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/rbac/v1beta1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/rbac/v1beta1/generated.pb.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/rbac/v1beta1/register.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/rbac/v1beta1/types.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/rbac/v1beta1/types_swagger_doc_generated.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/rbac/v1beta1/zz_generated.deepcopy.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/scheduling/v1alpha1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/scheduling/v1alpha1/generated.pb.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/scheduling/v1alpha1/register.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/scheduling/v1alpha1/types.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/scheduling/v1alpha1/types_swagger_doc_generated.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/scheduling/v1alpha1/zz_generated.deepcopy.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/scheduling/v1beta1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/scheduling/v1beta1/generated.pb.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/scheduling/v1beta1/register.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/scheduling/v1beta1/types.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/scheduling/v1beta1/types_swagger_doc_generated.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/scheduling/v1beta1/zz_generated.deepcopy.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/settings/v1alpha1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/settings/v1alpha1/generated.pb.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/settings/v1alpha1/register.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/settings/v1alpha1/types.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/settings/v1alpha1/types_swagger_doc_generated.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/settings/v1alpha1/zz_generated.deepcopy.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/storage/v1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/storage/v1/generated.pb.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/storage/v1/register.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/storage/v1/types.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/storage/v1/types_swagger_doc_generated.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/storage/v1/zz_generated.deepcopy.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/storage/v1alpha1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/storage/v1alpha1/generated.pb.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/storage/v1alpha1/register.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/storage/v1alpha1/types.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/storage/v1alpha1/types_swagger_doc_generated.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/storage/v1alpha1/zz_generated.deepcopy.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/storage/v1beta1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/storage/v1beta1/generated.pb.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/storage/v1beta1/register.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/storage/v1beta1/types.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/storage/v1beta1/types_swagger_doc_generated.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/api/storage/v1beta1/zz_generated.deepcopy.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/api/errors/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/api/errors/errors.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/api/meta/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/api/meta/errors.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/api/meta/firsthit_restmapper.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/api/meta/help.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/api/meta/interfaces.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/api/meta/lazy.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/api/meta/meta.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/api/meta/multirestmapper.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/api/meta/priority.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/api/meta/restmapper.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/api/resource/amount.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/api/resource/generated.pb.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/api/resource/math.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/api/resource/quantity.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/api/resource/quantity_proto.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/api/resource/scale_int.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/api/resource/suffix.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/api/resource/zz_generated.deepcopy.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/apis/meta/v1/controller_ref.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/apis/meta/v1/conversion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/apis/meta/v1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/apis/meta/v1/duration.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/apis/meta/v1/generated.pb.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/apis/meta/v1/group_version.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/apis/meta/v1/helpers.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/apis/meta/v1/labels.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/apis/meta/v1/meta.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/apis/meta/v1/micro_time.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/apis/meta/v1/micro_time_proto.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/apis/meta/v1/register.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/apis/meta/v1/time.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/apis/meta/v1/time_proto.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/apis/meta/v1/types.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/apis/meta/v1/types_swagger_doc_generated.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/apis/meta/v1/unstructured/helpers.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/apis/meta/v1/unstructured/unstructured.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/apis/meta/v1/unstructured/unstructured_list.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/apis/meta/v1/unstructured/zz_generated.deepcopy.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/apis/meta/v1/watch.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/apis/meta/v1/zz_generated.deepcopy.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/apis/meta/v1/zz_generated.defaults.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/apis/meta/v1beta1/conversion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/apis/meta/v1beta1/deepcopy.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/apis/meta/v1beta1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/apis/meta/v1beta1/generated.pb.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/apis/meta/v1beta1/register.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/apis/meta/v1beta1/types.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/apis/meta/v1beta1/types_swagger_doc_generated.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/apis/meta/v1beta1/zz_generated.deepcopy.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/apis/meta/v1beta1/zz_generated.defaults.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/conversion/converter.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/conversion/deep_equal.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/conversion/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/conversion/helper.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/conversion/queryparams/convert.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/conversion/queryparams/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/fields/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/fields/fields.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/fields/requirements.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/fields/selector.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/labels/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/labels/labels.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/labels/selector.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/labels/zz_generated.deepcopy.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/runtime/codec.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/runtime/codec_check.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/runtime/conversion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/runtime/converter.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/runtime/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/runtime/embedded.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/runtime/error.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/runtime/extension.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/runtime/generated.pb.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/runtime/helper.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/runtime/interfaces.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/runtime/register.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/runtime/schema/generated.pb.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/runtime/schema/group_version.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/runtime/schema/interfaces.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/runtime/scheme.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/runtime/scheme_builder.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/runtime/serializer/codec_factory.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/runtime/serializer/json/json.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/runtime/serializer/json/meta.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/runtime/serializer/negotiated_codec.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/runtime/serializer/protobuf/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/runtime/serializer/protobuf/protobuf.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/runtime/serializer/protobuf_extension.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/runtime/serializer/recognizer/recognizer.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/runtime/serializer/streaming/streaming.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/runtime/serializer/versioning/versioning.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/runtime/swagger_doc_generator.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/runtime/types.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/runtime/types_proto.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/runtime/zz_generated.deepcopy.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/selection/operator.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/types/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/types/namespacedname.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/types/nodename.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/types/patch.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/types/uid.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/util/clock/clock.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/util/duration/duration.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/util/errors/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/util/errors/errors.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/util/framer/framer.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/util/intstr/generated.pb.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/util/intstr/intstr.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/util/json/json.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/util/net/http.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/util/net/interface.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/util/net/port_range.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/util/net/port_split.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/util/net/util.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/util/runtime/runtime.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/util/sets/byte.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/util/sets/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/util/sets/empty.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/util/sets/int.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/util/sets/int64.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/util/sets/string.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/util/validation/field/errors.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/util/validation/field/path.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/util/validation/validation.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/util/wait/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/util/wait/wait.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/util/yaml/decoder.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/version/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/version/helpers.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/version/types.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/watch/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/watch/filter.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/watch/mux.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/watch/streamwatcher.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/watch/until.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/watch/watch.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/pkg/watch/zz_generated.deepcopy.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/apimachinery/third_party/forked/golang/reflect/deep_equal.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/discovery/cached_discovery.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/discovery/discovery_client.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/discovery/helper.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/discovery/round_tripper.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/discovery/unstructured.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/clientset.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/import.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/scheme/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/scheme/register.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/admissionregistration/v1alpha1/admissionregistration_client.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/admissionregistration/v1alpha1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/admissionregistration/v1alpha1/generated_expansion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/admissionregistration/v1alpha1/initializerconfiguration.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/admissionregistration/v1beta1/admissionregistration_client.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/admissionregistration/v1beta1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/admissionregistration/v1beta1/generated_expansion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/admissionregistration/v1beta1/mutatingwebhookconfiguration.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/admissionregistration/v1beta1/validatingwebhookconfiguration.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/apps/v1/apps_client.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/apps/v1/controllerrevision.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/apps/v1/daemonset.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/apps/v1/deployment.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/apps/v1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/apps/v1/generated_expansion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/apps/v1/replicaset.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/apps/v1/statefulset.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/apps/v1beta1/apps_client.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/apps/v1beta1/controllerrevision.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/apps/v1beta1/deployment.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/apps/v1beta1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/apps/v1beta1/generated_expansion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/apps/v1beta1/scale.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/apps/v1beta1/statefulset.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/apps/v1beta2/apps_client.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/apps/v1beta2/controllerrevision.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/apps/v1beta2/daemonset.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/apps/v1beta2/deployment.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/apps/v1beta2/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/apps/v1beta2/generated_expansion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/apps/v1beta2/replicaset.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/apps/v1beta2/scale.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/apps/v1beta2/statefulset.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/authentication/v1/authentication_client.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/authentication/v1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/authentication/v1/generated_expansion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/authentication/v1/tokenreview.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/authentication/v1/tokenreview_expansion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/authentication/v1beta1/authentication_client.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/authentication/v1beta1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/authentication/v1beta1/generated_expansion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/authentication/v1beta1/tokenreview.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/authentication/v1beta1/tokenreview_expansion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/authorization/v1/authorization_client.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/authorization/v1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/authorization/v1/generated_expansion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/authorization/v1/localsubjectaccessreview.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/authorization/v1/localsubjectaccessreview_expansion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/authorization/v1/selfsubjectaccessreview.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/authorization/v1/selfsubjectaccessreview_expansion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/authorization/v1/selfsubjectrulesreview.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/authorization/v1/selfsubjectrulesreview_expansion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/authorization/v1/subjectaccessreview.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/authorization/v1/subjectaccessreview_expansion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/authorization/v1beta1/authorization_client.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/authorization/v1beta1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/authorization/v1beta1/generated_expansion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/authorization/v1beta1/localsubjectaccessreview.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/authorization/v1beta1/localsubjectaccessreview_expansion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/authorization/v1beta1/selfsubjectaccessreview.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/authorization/v1beta1/selfsubjectaccessreview_expansion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/authorization/v1beta1/selfsubjectrulesreview.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/authorization/v1beta1/selfsubjectrulesreview_expansion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/authorization/v1beta1/subjectaccessreview.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/authorization/v1beta1/subjectaccessreview_expansion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/autoscaling/v1/autoscaling_client.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/autoscaling/v1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/autoscaling/v1/generated_expansion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/autoscaling/v1/horizontalpodautoscaler.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/autoscaling/v2beta1/autoscaling_client.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/autoscaling/v2beta1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/autoscaling/v2beta1/generated_expansion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/autoscaling/v2beta1/horizontalpodautoscaler.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/batch/v1/batch_client.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/batch/v1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/batch/v1/generated_expansion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/batch/v1/job.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/batch/v1beta1/batch_client.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/batch/v1beta1/cronjob.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/batch/v1beta1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/batch/v1beta1/generated_expansion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/batch/v2alpha1/batch_client.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/batch/v2alpha1/cronjob.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/batch/v2alpha1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/batch/v2alpha1/generated_expansion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/certificates/v1beta1/certificates_client.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/certificates/v1beta1/certificatesigningrequest.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/certificates/v1beta1/certificatesigningrequest_expansion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/certificates/v1beta1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/certificates/v1beta1/generated_expansion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/core/v1/componentstatus.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/core/v1/configmap.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/core/v1/core_client.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/core/v1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/core/v1/endpoints.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/core/v1/event.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/core/v1/event_expansion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/core/v1/generated_expansion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/core/v1/limitrange.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/core/v1/namespace.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/core/v1/namespace_expansion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/core/v1/node.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/core/v1/node_expansion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/core/v1/persistentvolume.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/core/v1/persistentvolumeclaim.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/core/v1/pod.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/core/v1/pod_expansion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/core/v1/podtemplate.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/core/v1/replicationcontroller.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/core/v1/resourcequota.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/core/v1/secret.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/core/v1/service.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/core/v1/service_expansion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/core/v1/serviceaccount.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/core/v1/serviceaccount_expansion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/events/v1beta1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/events/v1beta1/event.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/events/v1beta1/events_client.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/events/v1beta1/generated_expansion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/extensions/v1beta1/daemonset.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/extensions/v1beta1/deployment.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/extensions/v1beta1/deployment_expansion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/extensions/v1beta1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/extensions/v1beta1/extensions_client.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/extensions/v1beta1/generated_expansion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/extensions/v1beta1/ingress.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/extensions/v1beta1/podsecuritypolicy.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/extensions/v1beta1/replicaset.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/extensions/v1beta1/scale.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/extensions/v1beta1/scale_expansion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/networking/v1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/networking/v1/generated_expansion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/networking/v1/networking_client.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/networking/v1/networkpolicy.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/policy/v1beta1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/policy/v1beta1/eviction.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/policy/v1beta1/eviction_expansion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/policy/v1beta1/generated_expansion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/policy/v1beta1/poddisruptionbudget.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/policy/v1beta1/podsecuritypolicy.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/policy/v1beta1/policy_client.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/rbac/v1/clusterrole.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/rbac/v1/clusterrolebinding.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/rbac/v1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/rbac/v1/generated_expansion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/rbac/v1/rbac_client.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/rbac/v1/role.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/rbac/v1/rolebinding.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/rbac/v1alpha1/clusterrole.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/rbac/v1alpha1/clusterrolebinding.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/rbac/v1alpha1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/rbac/v1alpha1/generated_expansion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/rbac/v1alpha1/rbac_client.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/rbac/v1alpha1/role.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/rbac/v1alpha1/rolebinding.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/rbac/v1beta1/clusterrole.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/rbac/v1beta1/clusterrolebinding.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/rbac/v1beta1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/rbac/v1beta1/generated_expansion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/rbac/v1beta1/rbac_client.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/rbac/v1beta1/role.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/rbac/v1beta1/rolebinding.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/scheduling/v1alpha1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/scheduling/v1alpha1/generated_expansion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/scheduling/v1alpha1/priorityclass.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/scheduling/v1alpha1/scheduling_client.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/scheduling/v1beta1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/scheduling/v1beta1/generated_expansion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/scheduling/v1beta1/priorityclass.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/scheduling/v1beta1/scheduling_client.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/settings/v1alpha1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/settings/v1alpha1/generated_expansion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/settings/v1alpha1/podpreset.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/settings/v1alpha1/settings_client.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/storage/v1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/storage/v1/generated_expansion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/storage/v1/storage_client.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/storage/v1/storageclass.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/storage/v1alpha1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/storage/v1alpha1/generated_expansion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/storage/v1alpha1/storage_client.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/storage/v1alpha1/volumeattachment.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/storage/v1beta1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/storage/v1beta1/generated_expansion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/storage/v1beta1/storage_client.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/storage/v1beta1/storageclass.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/kubernetes/typed/storage/v1beta1/volumeattachment.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/pkg/apis/clientauthentication/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/pkg/apis/clientauthentication/register.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/pkg/apis/clientauthentication/types.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/pkg/apis/clientauthentication/v1alpha1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/pkg/apis/clientauthentication/v1alpha1/register.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/pkg/apis/clientauthentication/v1alpha1/types.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/pkg/apis/clientauthentication/v1alpha1/zz_generated.conversion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/pkg/apis/clientauthentication/v1alpha1/zz_generated.deepcopy.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/pkg/apis/clientauthentication/v1alpha1/zz_generated.defaults.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/pkg/apis/clientauthentication/v1beta1/conversion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/pkg/apis/clientauthentication/v1beta1/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/pkg/apis/clientauthentication/v1beta1/register.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/pkg/apis/clientauthentication/v1beta1/types.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/pkg/apis/clientauthentication/v1beta1/zz_generated.conversion.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/pkg/apis/clientauthentication/v1beta1/zz_generated.deepcopy.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/pkg/apis/clientauthentication/v1beta1/zz_generated.defaults.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/pkg/apis/clientauthentication/zz_generated.deepcopy.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/pkg/version/base.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/pkg/version/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/pkg/version/version.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/plugin/pkg/client/auth/exec/exec.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/rest/client.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/rest/config.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/rest/plugin.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/rest/request.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/rest/transport.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/rest/url_utils.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/rest/urlbackoff.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/rest/watch/decoder.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/rest/watch/encoder.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/rest/zz_generated.deepcopy.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/tools/clientcmd/api/doc.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/tools/clientcmd/api/helpers.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/tools/clientcmd/api/register.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/tools/clientcmd/api/types.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/tools/clientcmd/api/zz_generated.deepcopy.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/tools/metrics/metrics.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/tools/reference/ref.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/transport/cache.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/transport/config.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/transport/round_trippers.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/transport/transport.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/util/cert/cert.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/util/cert/csr.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/util/cert/io.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/util/cert/pem.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/util/connrotation/connrotation.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/util/flowcontrol/backoff.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/util/flowcontrol/throttle.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fe/vendor/k8s.io/client-go/util/integer/integer.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fortune/api/fortune.pb.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/fortune/main.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/hypothesizer/app.py",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/secrets/main.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/sidecar/src/main.rs",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/sleeper/index.js",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/snack/main.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/spoonerisms/src/index.js",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/vigoda/main.go",
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/premerge_112/words/app.py",
    ]
    let modifiedProtoList = [
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/merge_112/fortune/api/fortune.proto",
    ]
    let modifiedProgList = [
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/merge_112/doggos/main.go", 
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/merge_112/emoji/main.go", 
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/merge_112/fortune/main.go", 
        "/app/dataset/clone/servantes/pullrequest/fix_up_p…ufs_and_improve_ci/merge_112/sidecar/src/main.rs", 
        "/app/dataset/clone/servantes/pullrequest/fix_up_protobufs_and_improve_ci/merge_112/vigoda/main.go"
    ]

    main(protoPathList, programFileList, modifiedProtoList);

    //checkFileImportModule(protoPathList, programFileList, modifiedProtoList, modifiedProgList);
}

/*functions*/
async function main(protoPathList, programFileList, modifiedProtoList){
    const dependencies = await analyzeDependencies(protoPathList, programFileList);
    const affectedPrograms = findAffectedPrograms(modifiedProtoList, dependencies);
    console.log("Affected programs:", Array.from(affectedPrograms));
}


// プロジェクト全体の依存関係を解析
async function analyzeDependencies(protoPaths, programPaths) {
    const protoPackages = protoPaths.map(getProtoPackageName);
    const protoToPrograms = {};
    const programToPrograms = {};

    for (const progPath of programPaths) {
        const importedProtos = getImportedProtos(progPath, protoPaths);
        importedProtos.forEach(proto => {
            if (!protoToPrograms[proto]) {
                protoToPrograms[proto] = [];
            }
            protoToPrograms[proto].push(progPath);
        });

        // importしているものを取得
        const importedPrograms = await getImportedPrograms(progPath); // 非同期処理
        programToPrograms[progPath] = importedPrograms;
    }

    return { protoToPrograms, programToPrograms };
}

// 影響を受けるプログラムファイルを再帰的に探索
function findAffectedPrograms(modifiedProtos, dependencies) {
    const { protoToPrograms, programToPrograms } = dependencies;
    const affectedPrograms = new Set();

    function dfs(program) {
        if (affectedPrograms.has(program)) return;
        affectedPrograms.add(program);
        (programToPrograms[program] || []).forEach(dfs);
    }

    modifiedProtos.forEach(modProto => {
        const affected = protoToPrograms[getProtoPackageName(modProto)] || [];
        affected.forEach(dfs);
    });

    return affectedPrograms;
}

// プログラムファイルからimportしているprotoファイルを特定
//文字列一致
//proto違い packageは同じ
//相対パスか
function getImportedProtos(filePath, protoPaths) {
    const content = fs.readFileSync(filePath, 'utf8');
    const importedProtos = [];

    protoPaths.forEach(protoPath => {
        const protoPackageName = getProtoPackageName(protoPath);
        // より厳密にパッケージ名を特定するために正規表現を使う
        const importRegex = new RegExp(`import\\s+["'].*${path.basename(protoPath)}["'];`);
        if (importRegex.test(content)) {
            importedProtos.push(protoPackageName);
        }
    });

    return importedProtos;
}

async function getImportedProtos_Go(filePath, protoPaths) {
    const extension = path.extname(filePath);
    let imports = [];

    switch (extension) {
        case '.go':
            try {
                imports = await analyzeGoAst(filePath); // Promise が解決されるまで待機
                console.log(imports);
            } catch (err) {
                console.error("Error generating Go AST:", err);
                throw err; // エラーを呼び出し元に伝搬
            }
            break;

        case '.js':
            //imports = getJsImportsWithAST(filePath);
            break;
        case '.py':
            //imports = getPythonImportsWithAST(filePath);
            break;
        // 他の言語用のAST解析をここに追加
    }

    return imports;
}


// プログラムファイルからimportしている他のプログラムファイルを特定
async function getImportedPrograms(filePath) {
    const extension = path.extname(filePath);
    let imports = [];

    switch (extension) {
        case '.go':
            try {
                imports = await analyzeGoAst(filePath); // Promise が解決されるまで待機
                console.log(imports);
            } catch (err) {
                console.error("Error generating Go AST:", err);
                throw err; // エラーを呼び出し元に伝搬
            }
            break; 

        case '.js':
            //imports = getJsImportsWithAST(filePath);
            break;
        case '.py':
            //imports = getPythonImportsWithAST(filePath);
            break;
        // 他の言語用のAST解析をここに追加
    }

    return imports;
}

// protoファイルからpackage名を取得
function getProtoPackageName(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const packageMatch = content.match(/package\s+([\w.]+);/);
    return packageMatch ? packageMatch[1] : null;
}




/****************** */
function getGoImportsWithAST(filePath) {

}

//esprima
// JavaScriptファイルのimportをASTで解析
function getJsImportsWithAST(filePath) {
    // const content = readFile(filePath);
    // // const ast = esprima.parseModule(content);
    // const imports = [];

    // ast.body.forEach(node => {
    //     if (node.type === 'ImportDeclaration') {
    //         imports.push(node.source.value);
    //     }
    // });

    // return imports;
}





/************************/
async function checkFileImportModule(protoFileList, progFileList, modifiedProtoList, modifiedProgList) {
    const importedFiles = []; // インポートされたファイルを格納する配列

    const protoPackages = extractPackageNames(modifiedProtoList);

    // プログラムファイルリストをループ
    for (let i = 0; i < progFileList.length; i++) {
        const progFile = progFileList[i];
        //const packageName = protoPackages[i]

        try {
            // AST生成を非同期に待機
            const ast = await generateAstBasedOnExtension(progFile);

            if (ast !== null) {
                for (let j = 0; j < protoFileList.length; j++) {
                    const protoFile = protoFileList[j];

                    // ASTが生成された場合にprotoファイルがインポートされているかを確認
                    if (isProtoFileImported(ast, progFile, protoFile)) {
                        importedFiles.push(protoFile);
                    }
                }
            }
        } catch (err) {
            console.error(`Error processing ${progFile}:`, err);
        }
    }

    return importedFiles; // インポートされたファイルのリストを返す
}

//proto packageの取得
function extractPackageNames(protoFiles) {
    const packageNames = protoFiles.map(filePath => {
        try {
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const packageMatch = fileContent.match(/^\s*package\s+([\w\.]+)\s*;/m);
            if (packageMatch) {
                return packageMatch[1];
            } else {
                console.warn(`No package name found in file: ${filePath}`);
                return null;
            }
        } catch (error) {
            console.error(`Error reading file ${filePath}:`, error);
            return null;
        }
    });

    // Filter out null values (files without a package name or read errors)
    return packageNames.filter(name => name !== null);
}

//ファイルの行数確認
function shouldSkipAstGeneration(filePath, callback) {
    const rl = readline.createInterface({
        input: fs.createReadStream(filePath),
        crlfDelay: Infinity
    });

    let lineCount = 0;
    let hasExceeded = false;  // フラグを追加

    rl.on('line', () => {
        lineCount++;
        // 8000行を超えたらチェックをやめてスキップ指示を返す
        if (lineCount > 8000) {
            hasExceeded = true;
            rl.close();  // `close` イベントをトリガー
        }
    });

    rl.on('close', () => {
        // 8000行を超えたらtrueを返す
        if (hasExceeded) {
            callback(true);
        } else {
            callback(false);
        }
    });
}


//拡張子の判別
function generateAstBasedOnExtension(filePath) {
    
    const ext = filePath.slice(filePath.lastIndexOf('.'));
    const lang = allowedExtensions[ext];

    if (!lang) {
        console.log('Unsupported language');
        return Promise.resolve(null);  // Promiseとしてnullを返す
    }

    // PromiseでAST生成を非同期に処理
    return new Promise((resolve, reject) => {
        shouldSkipAstGeneration(filePath, (shouldSkip) => {
            if (shouldSkip) {
                console.log('File too large, skipping AST generation.');
                resolve(null);  // ファイルが大きすぎる場合はnullを返す
            } else {
                switch (lang) {
                    // case 'python':
                    //     return generatePythonAst(filePath);
                    case 'go':
                        analyzeGoAst(filePath)
                        .then(ast => resolve(ast))  // 成功時にASTを返す
                        .catch(err => {
                            console.error("Error generating Go AST:", err);
                            reject(err);  // エラー時はエラーを返す
                        });
                        break;
                    // case 'java':
                    //     return generateJavaAst(filePath);  
                    // case 'csharp':
                    //     return generateCSharpAst(filePath);
                    // case 'scala':
                    //     return generateScalaAst(filePath); 
                    // case 'typescript':
                    //     return generateTypeScriptAst(filePath);
                    // case 'cpp':
                    //     return generateCppAst(filePath);   
                    // case 'javascript':
                    //     return generateJavaScriptAst(filePath);
                    // case 'rust':
                    //     return generateRustAst(filePath);  
                    default:
                        console.log('Unsupported language');
                        resolve(null);  // サポートされていない言語の場合
                }
            }
        });
    });
}

//AST解析を行う
function isProtoFileImported(ast, programFile, protoFile) {
    const ext = filePath.slice(filePath.lastIndexOf('.'));
    const lang = allowedExtensions[ext];

    return new Promise((resolve, reject) => {
        shouldSkipAstGeneration(filePath, (shouldSkip) => {
            if (shouldSkip) {
                console.log('File too large, skipping AST generation.');
                resolve(null);  // ファイルが大きすぎる場合はnullを返す
            } else {
                switch (lang) {
                    // case 'python':
                    //     return generatePythonAst(filePath);
                    case 'go':
                        goFetcher(filePath)
                            .then(ast => resolve(ast))  // 成功時にASTを返す
                            .catch(err => {
                                console.error("Error generating Go AST:", err);
                                reject(err);  // エラー時はエラーを返す
                            });
                        break;
                    // case 'java':
                    //     return generateJavaAst(filePath);  
                    // case 'csharp':
                    //     return generateCSharpAst(filePath);
                    // case 'scala':
                    //     return generateScalaAst(filePath); 
                    // case 'typescript':
                    //     return generateTypeScriptAst(filePath);
                    // case 'cpp':
                    //     return generateCppAst(filePath);   
                    // case 'javascript':
                    //     return generateJavaScriptAst(filePath);
                    // case 'rust':
                    //     return generateRustAst(filePath);  
                    default:
                        console.log('Unsupported language');
                        resolve(null);  // サポートされていない言語の場合
                }
            }
        });
    });
}


module.exports = { checkFileImportModule };