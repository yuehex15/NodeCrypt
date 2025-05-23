// util.avatar.js - 头像生成工具 (NPM模式)
import * as dicebearCore from '@dicebear/core';
import * as dicebearMicah from '@dicebear/micah';

const bgColors = ["f87171","fb923c","09acf4", "fb923c", "f472b6","a78bfa","34d399"];
function pickColor(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return bgColors[Math.abs(hash) % bgColors.length];
}

export function createAvatarSVG(userName) {
  return dicebearCore.createAvatar(dicebearMicah, { 
    seed: userName, 
    baseColor: ["f7e1c3", "f9c9b6", "f2d6cb", "f8ce8e", "eac393"],
    backgroundColor: [pickColor(userName)]
  }).toString();
}