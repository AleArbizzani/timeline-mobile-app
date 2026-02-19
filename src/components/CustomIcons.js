import React from 'react';
import Svg, { Rect, Path } from 'react-native-svg';

export const YCIcon = ({ width = 20, height = 20, ...props }) => (
  <Svg width={width} height={height} viewBox="0 0 20 20" fill="none" {...props}>
    <Rect x="3" width="14" height="20" rx="2" fill="#FAA613" />
  </Svg>
);

export const RCIcon = ({ width = 20, height = 20, ...props }) => (
  <Svg width={width} height={height} viewBox="0 0 20 20" fill="none" {...props}>
    <Rect x="3" width="14" height="20" rx="2" fill="#F72C25" />
  </Svg>
);

export const GoalIcon = ({ width = 24, height = 24, ...props }) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none" {...props}>
    <Path
      d="M12 2C17.523 2 22 6.477 22 12C22 17.523 17.523 22 12 22C6.477 22 2 17.523 2 12C2 6.477 6.477 2 12 2ZM13.67 16H10.33L8.95 17.897L9.504 19.603C10.3097 19.8668 11.1522 20.0008 12 20C12.871 20 13.71 19.86 14.496 19.603L15.049 17.897L13.67 16ZM5.294 10.872L4.002 11.81L4 12C4 13.73 4.549 15.331 5.482 16.64H7.392L8.715 14.82L7.687 11.65L5.294 10.872ZM18.706 10.872L16.313 11.65L15.285 14.82L16.607 16.64H18.517C19.4841 15.2863 20.0027 13.6636 20 12L19.997 11.809L18.706 10.872ZM14.29 4.333L13 5.273V7.79L15.694 9.747L17.934 9.02L18.488 7.317C17.4564 5.88712 15.9813 4.8381 14.292 4.333M9.71 4.333C8.02058 4.83836 6.54546 5.88774 5.514 7.318L6.068 9.02L8.307 9.747L11 7.79V5.273L9.71 4.333Z"
      fill="#688E26"
    />
  </Svg>
);

export const WhistleIcon = ({ width = 16, height = 16, ...props }) => (
  <Svg width={width} height={height} viewBox="0 0 16 16" fill="none" {...props}>
    <Path
      d="M10 8C11.5 14 2 16 2 8H10ZM0 8V6H2L4 4H8V6H10V4H16V6L10 8"
      fill="#02111B"
    />
  </Svg>
);

export const SecondYC_RCIcon = ({ width = 20, height = 20, ...props }) => (
  <Svg width={width} height={height} viewBox="0 0 20 20" fill="none" {...props}>
    <Rect x="2" width="12" height="17" rx="2" fill="#FAA613" />
    <Rect x="6" y="3" width="12" height="17" rx="2" fill="#F72C25" />
  </Svg>
);

export const OwnGoalIcon = ({ width = 24, height = 24, ...props }) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none" {...props}>
    <Path
      d="M12 2C17.523 2 22 6.477 22 12C22 17.523 17.523 22 12 22C6.477 22 2 17.523 2 12C2 6.477 6.477 2 12 2ZM13.67 16H10.33L8.95 17.897L9.504 19.603C10.3097 19.8668 11.1522 20.0008 12 20C12.871 20 13.71 19.86 14.496 19.603L15.049 17.897L13.67 16ZM5.294 10.872L4.002 11.81L4 12C4 13.73 4.549 15.331 5.482 16.64H7.392L8.715 14.82L7.687 11.65L5.294 10.872ZM18.706 10.872L16.313 11.65L15.285 14.82L16.607 16.64H18.517C19.4841 15.2863 20.0027 13.6636 20 12L19.997 11.809L18.706 10.872ZM14.29 4.333L13 5.273V7.79L15.694 9.747L17.934 9.02L18.488 7.317C17.4564 5.88712 15.9813 4.8381 14.292 4.333M9.71 4.333C8.02058 4.83836 6.54546 5.88774 5.514 7.318L6.068 9.02L8.307 9.747L11 7.79V5.273L9.71 4.333Z"
      fill="#F72C25"
    />
  </Svg>
);

export const OffsideIcon = ({ width = 20, height = 20, ...props }) => (
  <Svg width={width} height={height} viewBox="0 0 20 20" fill="none" {...props}>
    <Path
      d="M10.9084 2.745C12.5117 3.53666 13.76 4.15333 15.4684 3.32166C15.5955 3.25973 15.7363 3.23116 15.8775 3.23864C16.0187 3.24612 16.1556 3.28941 16.2755 3.36442C16.3953 3.43943 16.4941 3.54371 16.5626 3.66744C16.631 3.79116 16.6669 3.93027 16.6667 4.07166V12.0217C16.6669 12.178 16.623 12.3313 16.5402 12.4639C16.4574 12.5965 16.3389 12.7032 16.1984 12.7717C13.7142 13.98 11.7134 12.9717 10.1567 12.1875C9.9847 12.0998 9.81192 12.0137 9.63837 11.9292C8.77754 11.515 8.06587 11.2525 7.34171 11.2875C6.70837 11.3175 5.94837 11.585 5.00004 12.4508V17.5C5.00004 17.721 4.91224 17.933 4.75596 18.0893C4.59968 18.2455 4.38772 18.3333 4.16671 18.3333C3.94569 18.3333 3.73373 18.2455 3.57745 18.0893C3.42117 17.933 3.33337 17.721 3.33337 17.5V4.1425C3.33351 4.03242 3.35544 3.92345 3.39793 3.8219C3.44041 3.72035 3.50259 3.62822 3.58087 3.55083C4.84921 2.29583 6.05337 1.73 7.26171 1.67166C8.43421 1.615 9.47254 2.04916 10.3617 2.4775C10.5489 2.56805 10.7309 2.65694 10.9075 2.74416L10.9084 2.745Z"
      fill="#02111B"
    />
  </Svg>
);

export const KmiIcon = ({ width = 20, height = 20, ...props }) => (
  <Svg width={width} height={height} viewBox="0 0 20 20" fill="none" {...props}>
    <Path
      d="M10 14.3958L6.5417 16.4792C6.38892 16.5764 6.2292 16.618 6.06253 16.6042C5.89586 16.5903 5.75003 16.5347 5.62503 16.4375C5.50003 16.3403 5.40281 16.2189 5.33336 16.0733C5.26392 15.9278 5.25003 15.7644 5.2917 15.5833L6.20836 11.6458L3.14586 8.99999C3.00697 8.87499 2.92031 8.73249 2.88586 8.57249C2.85142 8.41249 2.8617 8.25638 2.9167 8.10416C2.9717 7.95193 3.05503 7.82693 3.1667 7.72916C3.27836 7.63138 3.43114 7.56888 3.62503 7.54166L7.6667 7.18749L9.2292 3.47916C9.29864 3.31249 9.40642 3.18749 9.55253 3.10416C9.69864 3.02082 9.84781 2.97916 10 2.97916C10.1523 2.97916 10.3014 3.02082 10.4475 3.10416C10.5936 3.18749 10.7014 3.31249 10.7709 3.47916L12.3334 7.18749L16.375 7.54166C16.5695 7.56943 16.7223 7.63193 16.8334 7.72916C16.9445 7.82638 17.0278 7.95138 17.0834 8.10416C17.1389 8.25694 17.1495 8.41332 17.115 8.57332C17.0806 8.73332 16.9936 8.87555 16.8542 8.99999L13.7917 11.6458L14.7084 15.5833C14.75 15.7639 14.7361 15.9272 14.6667 16.0733C14.5973 16.2194 14.5 16.3408 14.375 16.4375C14.25 16.5342 14.1042 16.5897 13.9375 16.6042C13.7709 16.6186 13.6111 16.5769 13.4584 16.4792L10 14.3958Z"
      fill="#6155F5"
    />
  </Svg>
);

export const FourthIcon = ({ width = 14, height = 14, ...props }) => (
  <Svg width={width} height={height} viewBox="0 0 14 14" fill="none" {...props}>
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M1.625 10.625V5.125H12.375V10.625C12.375 10.7245 12.3355 10.8198 12.2652 10.8902C12.1948 10.9605 12.0995 11 12 11H2C1.90054 11 1.80516 10.9605 1.73483 10.8902C1.66451 10.8198 1.625 10.7245 1.625 10.625ZM0.375 3.625C0.375 2.728 1.103 2 2 2H12C12.898 2 13.625 2.728 13.625 3.625V10.625C13.625 11.522 12.898 12.25 12 12.25C8.66667 12.25 5.33333 12.249 2 12.249C1.5692 12.249 1.15602 12.0779 0.851305 11.7734C0.546587 11.4689 0.375265 11.0558 0.375 10.625V3.625Z"
      fill="#02111B"
    />
  </Svg>
);

const ICON_MAP = {
  YC: YCIcon,
  RC: RCIcon,
  Goal: GoalIcon,
  Whistle: WhistleIcon,
  SecondYC_RC: SecondYC_RCIcon,
  'Own-goal': OwnGoalIcon,
  Offside: OffsideIcon,
  Kmi: KmiIcon,
  '4th': FourthIcon,
};

const ICON_NAMES = Object.keys(ICON_MAP);

export function getCustomIcon(name) {
  if (!name || typeof name !== 'string') return null;
  const trimmed = name.trim();
  const Icon = ICON_MAP[trimmed];
  if (Icon) return Icon;
  const lower = trimmed.toLowerCase();
  const match = ICON_NAMES.find((k) => k.toLowerCase() === lower);
  return match ? ICON_MAP[match] : null;
}

export function getIconNameFromPathCodes(pathCodes) {
  const names = getIconNamesFromPathCodes(pathCodes);
  return names.length > 0 ? names[0] : null;
}

/**
 * Returns all icon names found in path_codes, in order, without duplicates.
 * Use when a row can have multiple icons (e.g. YC + Kmi).
 */
export function getIconNamesFromPathCodes(pathCodes) {
  if (!Array.isArray(pathCodes) || !pathCodes.length) return [];
  const seen = new Set();
  const result = [];
  for (const code of pathCodes) {
    const str = String(code ?? '').trim();
    const match = ICON_MAP[str]
      ? str
      : ICON_NAMES.find((k) => k.toLowerCase() === str.toLowerCase());
    if (match && !seen.has(match)) {
      seen.add(match);
      result.push(match);
    }
  }
  return result;
}
