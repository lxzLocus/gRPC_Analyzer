from find_proto import get_proto_file_contents_recursive
from format_proto import format_proto_content
from diff_proto import compare_proto_files
from req import request_openai


source_code = "def some_function(): pass"
input_directory = '/app/dataset/clone/loop/pullrequest/update_api_for_loop_in'


# get proto
proto_content = get_proto_file_contents_recursive(input_directory)
formated_proto_content = format_proto_content(proto_content)

# get proto diff
file_changes = compare_proto_files(input_directory)
    

# api request
response = request_openai(formated_proto_content, file_changes, source_code)
print(response)




