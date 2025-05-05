// 头像生成工具
let dicebear = null;
let micah = null;

async function ensureDicebear() {
  if (!dicebear || !micah) {
    dicebear = await import('https://cdn.jsdelivr.net/npm/@dicebear/core@9.2.2/+esm');
    micah = (await import('https://cdn.jsdelivr.net/npm/@dicebear/collection@9.2.2/+esm')).micah;
  }
}

export async function createAvatarSVG(userName) {
  await ensureDicebear();
  return dicebear.createAvatar(micah, { seed: userName, baseColor: ["f7e1c3", "f9c9b6", "f2d6cb", "f8ce8e", "eac393"],backgroundColor: ["b6e3f4","c0aede","d1d4f9"],backgroundType: ["gradientLinear","solid"] }).toString();
}
