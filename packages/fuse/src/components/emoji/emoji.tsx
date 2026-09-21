/**
 * Twemoji-derived face SVGs. Graphics remain CC BY 4.0 — see
 * packages/fuse/THIRD_PARTY_NOTICES.md and licenses/twemoji-CC-BY-4.0.txt.
 *
 * Hex fills are brand-independent illustration artwork, intentionally exempt
 * from the tokens-only rule. `no-primitive-colors` targets
 * Tailwind palette classes, not SVG attribute fills.
 */
import type { ComponentProps, ReactElement, ReactNode } from "react";

export type EmojiProps = ComponentProps<"svg"> & {
  /**
   * Accessible name. When set, the svg is `role="img"` with this `aria-label`.
   * When omitted, the svg is decorative (`aria-hidden` + `focusable="false"`).
   */
  label?: string;
};

function EmojiSvg({ label, children, ...props }: EmojiProps & { children: ReactNode }): ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 36 36"
      data-slot="emoji"
      aria-hidden={label ? undefined : true}
      focusable="false"
      role={label ? "img" : undefined}
      aria-label={label}
      {...props}>
      {children}
    </svg>
  );
}

function SlightlyFrowningFace(props: EmojiProps): ReactElement {
  return (
    <EmojiSvg {...props}>
      <circle fill="#FFCC4D" cx="18" cy="18" r="18" />
      <path
        fill="#664500"
        d="M25.485 27.379C25.44 27.2 24.317 23 18 23c-6.318 0-7.44 4.2-7.485 4.379-.055.217.043.442.237.554.195.111.439.078.6-.077C11.371 27.837 13.306 26 18 26s6.63 1.837 6.648 1.855c.096.095.224.145.352.145.084 0 .169-.021.246-.064.196-.112.294-.339.239-.557z"
      />
      <ellipse fill="#664500" cx="12" cy="13.5" rx="2.5" ry="3.5" />
      <ellipse fill="#664500" cx="24" cy="13.5" rx="2.5" ry="3.5" />
    </EmojiSvg>
  );
}

function SlightlySmilingFace(props: EmojiProps): ReactElement {
  return (
    <EmojiSvg {...props}>
      <circle fill="#FFCC4D" cx="18" cy="18" r="18" />
      <path
        fill="#664500"
        d="M10.515 23.621C10.56 23.8 11.683 28 18 28c6.318 0 7.44-4.2 7.485-4.379.055-.217-.043-.442-.237-.554-.195-.111-.439-.078-.6.077C24.629 23.163 22.694 25 18 25s-6.63-1.837-6.648-1.855C11.256 23.05 11.128 23 11 23c-.084 0-.169.021-.246.064-.196.112-.294.339-.239.557z"
      />
      <ellipse fill="#664500" cx="12" cy="13.5" rx="2.5" ry="3.5" />
      <ellipse fill="#664500" cx="24" cy="13.5" rx="2.5" ry="3.5" />
    </EmojiSvg>
  );
}

function NeutralFace(props: EmojiProps): ReactElement {
  return (
    <EmojiSvg {...props}>
      <path
        fill="#FFCC4D"
        d="M36 18c0 9.941-8.059 18-18 18-9.94 0-18-8.059-18-18C0 8.06 8.06 0 18 0c9.941 0 18 8.06 18 18"
      />
      <ellipse fill="#664500" cx="11.5" cy="16.5" rx="2.5" ry="3.5" />
      <ellipse fill="#664500" cx="24.5" cy="16.5" rx="2.5" ry="3.5" />
      <path fill="#664500" d="M25 26H11c-.552 0-1-.447-1-1s.448-1 1-1h14c.553 0 1 .447 1 1s-.447 1-1 1z" />
    </EmojiSvg>
  );
}

function LoudlyCryingFace(props: EmojiProps): ReactElement {
  return (
    <EmojiSvg {...props}>
      <path fill="#FFCC4D" d="M36 18c0 9.941-8.059 18-18 18S0 27.941 0 18 8.059 0 18 0s18 8.059 18 18" />
      <path
        fill="#664500"
        d="M22 27c0 2.763-1.791 3-4 3-2.21 0-4-.237-4-3 0-2.761 1.79-6 4-6 2.209 0 4 3.239 4 6zm8-12c-.124 0-.25-.023-.371-.072-5.229-2.091-7.372-5.241-7.461-5.374-.307-.46-.183-1.081.277-1.387.459-.306 1.077-.184 1.385.274.019.027 1.93 2.785 6.541 4.629.513.206.763.787.558 1.3-.157.392-.533.63-.929.63zM6 15c-.397 0-.772-.238-.929-.629-.205-.513.044-1.095.557-1.3 4.612-1.844 6.523-4.602 6.542-4.629.308-.456.929-.577 1.387-.27.457.308.581.925.275 1.383-.089.133-2.232 3.283-7.46 5.374C6.25 14.977 6.124 15 6 15z"
      />
      <path fill="#5DADEC" d="M24 16h4v19l-4-.046V16zM8 35l4-.046V16H8v19z" />
      <path
        fill="#664500"
        d="M14.999 18c-.15 0-.303-.034-.446-.105-3.512-1.756-7.07-.018-7.105 0-.495.249-1.095.046-1.342-.447-.247-.494-.047-1.095.447-1.342.182-.09 4.498-2.197 8.895 0 .494.247.694.848.447 1.342-.176.35-.529.552-.896.552zm14 0c-.15 0-.303-.034-.446-.105-3.513-1.756-7.07-.018-7.105 0-.494.248-1.094.047-1.342-.447-.247-.494-.047-1.095.447-1.342.182-.09 4.501-2.196 8.895 0 .494.247.694.848.447 1.342-.176.35-.529.552-.896.552z"
      />
      <ellipse fill="#5DADEC" cx="18" cy="34" rx="18" ry="2" />
      <ellipse fill="#E75A70" cx="18" cy="27" rx="3" ry="2" />
    </EmojiSvg>
  );
}

function PartyingFace(props: EmojiProps): ReactElement {
  return (
    <EmojiSvg {...props}>
      <circle fill="#FFCC4D" cx="17" cy="19" r="17" />
      <ellipse fill="#664500" cx="17.999" cy="26" rx="2" ry="2.5" />
      <path
        fill="#664500"
        d="M8.111 21.383c-.182 0-.367-.05-.532-.154-.467-.294-.607-.911-.313-1.379.916-1.453 3.701-3.938 7.69-2.962.536.131.864.673.733 1.209-.132.536-.676.862-1.209.733-3.604-.882-5.502 2.056-5.521 2.086-.191.302-.516.467-.848.467zm11.973-3.742c-.29 0-.576-.125-.774-.366-.35-.427-.288-1.058.14-1.408 3.176-2.604 6.762-1.562 8.215-.646.467.294.607.912.312 1.379-.293.465-.908.607-1.376.315-.138-.084-3.052-1.823-5.884.499-.186.153-.41.227-.633.227z"
      />
      <path
        fill="#E2A62D"
        d="M13.346 31.273c-.068 0-.137-.009-.205-.028-.398-.113-.63-.527-.517-.926.437-1.54.258-3.029-.49-4.086-.497-.702-1.205-1.131-1.943-1.178-.414-.025-.728-.382-.702-.795s.381-.751.795-.701c1.193.074 2.313.733 3.073 1.807 1.011 1.429 1.27 3.383.709 5.361-.093.331-.394.546-.72.546zm11.037-3.061c-.142 0-.285-.04-.412-.124-1.167-.77-1.82-2.117-1.792-3.695.029-1.635.809-3.153 1.984-3.869.353-.216.814-.104 1.03.251.216.354.104.814-.251 1.03-.735.448-1.244 1.499-1.264 2.614-.02 1.055.389 1.936 1.118 2.417.346.228.441.693.213 1.039-.144.219-.382.337-.626.337z"
      />
      <path
        fill="#DD2E44"
        d="M17.179 2.72c-.043-.049-.11-.076-.189-.091 0 0-15.924-3.023-16.613-2.415C-.311.823.74 16.998.74 16.998c.005.081.023.15.067.199.604.684 4.758-2.004 9.279-6.001 4.522-3.998 7.697-7.792 7.093-8.476z"
      />
      <path
        fill="#EA596E"
        d="M.349.271C.334.301.321.342.311.394.47 1.765 2.006 13.046 2.963 16.572c1.436-.803 2.895-1.894 4.609-3.253C6.116 10.654 1.158.146.349.271z"
      />
      <path
        fill="#3B88C3"
        d="M29.902 29.229l-10.573-1.303c-1.13-.102-3.117-.112-3.015-1.902.093-1.623 2.04-1.373 3.479-1.16l10.638 1.774-.529 2.591z"
      />
      <path
        fill="#88C9F9"
        d="M30.43 26.639l-4.222-.724c-.494-.089-.934.647-.956 1.426-.025.866.227 1.304.726 1.406l4.144.512.308-2.62z"
      />
      <path
        fill="#3B88C3"
        d="M34.918 26.341l-2.622 2.411-4.687-5.097 2.622-2.411c1.361-1.252 3.499-1.162 4.751.199l.135.147c1.251 1.362 1.162 3.499-.199 4.751z"
      />
      <ellipse
        transform="rotate(-42.597 29.954 26.205)"
        fill="#88C9F9"
        cx="29.952"
        cy="26.203"
        rx="2.77"
        ry="3.462"
      />
      <ellipse
        transform="rotate(-42.597 29.954 26.205)"
        fill="#269"
        cx="29.952"
        cy="26.203"
        rx="1.385"
        ry="2.077"
      />
      <circle fill="#55ACEE" cx="2.5" cy="33.5" r="1.5" />
      <circle fill="#55ACEE" cx="29" cy="2" r="2" />
      <path fill="#EA596E" d="M4.864 29.246L2.526 23.63.412 29.675zM26 5l-4 1 1-4z" />
      <path fill="#77B255" d="M31.999 13L36 7.999 33 6z" />
    </EmojiSvg>
  );
}

SlightlyFrowningFace.displayName = "Emoji.SlightlyFrowningFace";
SlightlySmilingFace.displayName = "Emoji.SlightlySmilingFace";
NeutralFace.displayName = "Emoji.NeutralFace";
LoudlyCryingFace.displayName = "Emoji.LoudlyCryingFace";
PartyingFace.displayName = "Emoji.PartyingFace";

const Emoji = {
  SlightlyFrowningFace,
  SlightlySmilingFace,
  NeutralFace,
  LoudlyCryingFace,
  PartyingFace,
};

export { Emoji, LoudlyCryingFace, NeutralFace, PartyingFace, SlightlyFrowningFace, SlightlySmilingFace };
