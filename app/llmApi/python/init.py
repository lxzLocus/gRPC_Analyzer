from find_proto import get_proto_file_contents_recursive
from format_proto import format_proto_content
from diff_proto import compare_proto_files
from find_useproto import find_usingproto
from convert_string import read_file_as_string
from req import request_openai


source_code = "/app/dataset/openaiapi/premerge/cmd/server/main.go"
input_directory = '/app/dataset/openaiapi'


# get proto
proto_content = get_proto_file_contents_recursive(input_directory)
formated_proto_content = format_proto_content(proto_content)

# get proto diff
file_changes = compare_proto_files(input_directory)

source = find_usingproto(input_directory)


source_code_strings = read_file_as_string(source_code)
    

# api request
response = request_openai(formated_proto_content, file_changes, source_code_strings)
print(response)




