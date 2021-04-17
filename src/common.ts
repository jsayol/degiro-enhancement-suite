export interface Settings {
  locale: string;
  theme: string;
}

export function getRandomColor() {
  const hexChars = "0123456789ABCDEF";
  let randomColor = "#";

  for (let i = 0; i < 6; i++) {
    randomColor += hexChars[Math.floor(Math.random() * 16)];
  }

  return randomColor;
}
