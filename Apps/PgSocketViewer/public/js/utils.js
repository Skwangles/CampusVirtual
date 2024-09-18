export function inv(pose) {

  let res = new Array();
  for (let i = 0; i < 3; i++) {
    res.push([0, 0, 0, 0]);
  }
  // - R^T * t
  res[0][3] = - pose[0][0] * pose[0][3] - pose[1][0] * pose[1][3] - pose[2][0] * pose[2][3];
  res[1][3] = - pose[0][1] * pose[0][3] - pose[1][1] * pose[1][3] - pose[2][1] * pose[2][3];
  res[2][3] = - pose[0][2] * pose[0][3] - pose[1][2] * pose[1][3] - pose[2][2] * pose[2][3];
  res[0][0] = pose[0][0]; res[0][1] = pose[1][0]; res[0][2] = pose[2][0];
  res[1][0] = pose[0][1]; res[1][1] = pose[1][1]; res[1][2] = pose[2][1];
  res[2][0] = pose[0][2]; res[2][1] = pose[1][2]; res[2][2] = pose[2][2];

  return res;
}

// function that converts array that have size of 16 to matrix that shape of 4x4
export function array2mat44(mat, array) {
  for (let i = 0; i < 4; i++) {
    let raw = [];
    for (let j = 0; j < 4; j++) {
      let k = i * 4 + j;
      let elm = array[k];
      raw.push(elm);
    }
    mat.push(raw);
  }
}