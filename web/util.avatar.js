// 头像生成工具
let dicebear = null;
let micah = null;

async function ensureDicebear() {
  if (!dicebear || !micah) {
    dicebear = await import('https://cdn.jsdelivr.net/npm/@dicebear/core@9.2.2/+esm');
    micah = await import('https://cdn.jsdelivr.net/npm/@dicebear/micah@9.2.2/+esm');
  }
}

ensureDicebear();

export async function createAvatarSVG(userName) {
  await ensureDicebear();
  return dicebear.createAvatar(micah, { 
    seed: userName, 
    baseColor: ["f7e1c3", "f9c9b6", "f2d6cb", "f8ce8e", "eac393"],
    backgroundColor: ["f87171","fb923c","09acf4", "fb923c", "f472b6","a78bfa","34d399"],
    backgroundType: ["gradientLinear"] 
  }).toString();
}