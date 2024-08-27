import path from 'path'
export function stripDirectoryTraversal(user_input: string, root: string) {
  var safe_input = path.normalize(user_input);
  if (safe_input.indexOf(root) !== 0) {
    return false;
  }
  return safe_input;
}