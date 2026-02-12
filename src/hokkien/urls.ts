export const cleanHanzi = (text: string) => text.replace(/【.*?】/g, "").trim();

export const getMoeEntryUrl = (entryId: number) =>
  `https://sutian.moe.edu.tw/zh-hant/su/${entryId}/`;

export const getMoeAudioUrl = (entryId: number) => {
  const folder = Math.floor(entryId / 1000);
  return `https://sutian.moe.edu.tw/media/senn/mp3/imtong/subak/${folder}/${entryId}.mp3`;
};

export const getSuiSiannUrl = (text: string) => {
  const cleanedText = cleanHanzi(text);
  if (!cleanedText) return null;
  return `http://suisiann.ithuan.tw/%E8%AC%9B/${encodeURIComponent(cleanedText)}`;
};

export const getAppEntryUrl = (baseUrl: string, entryId: number) => {
  const trimmed = baseUrl.replace(/\/$/, "");
  return `${trimmed}/?su=${entryId}`;
};
