interface HTMLElementWithStyle extends HTMLElement {
  style: CSSStyleDeclaration;
}

interface LightEffectElement extends HTMLElementWithStyle {
  style: CSSStyleDeclaration & {
    opacity: string;
    transform: string;
  };
}

interface BentoCellElement extends HTMLElementWithStyle {
  style: CSSStyleDeclaration & {
    borderImage: string;
  };
  dataset: DOMStringMap & {
    lightBound?: string;
  };
}

type MugaBentoWindow = Window &
  typeof globalThis & {
    __mugaBentoGridBound?: boolean;
  };

function throttle(callback: Function, limit: number) {
  let waiting = false;
  return function (this: any, ...args: any[]) {
    if (!waiting) {
      callback.apply(this, args);
      waiting = true;
      setTimeout(() => {
        waiting = false;
      }, limit);
    }
  };
}

function applyLightEffect() {
  const bentoCells = document.querySelectorAll<BentoCellElement>(".bento-cell");

  bentoCells.forEach((cell) => {
    if (cell.dataset.lightBound === "true") return;

    const lightEffect = cell.querySelector<LightEffectElement>(".light-effect");
    if (!lightEffect) return;

    cell.addEventListener("mouseenter", () => {
      lightEffect.style.opacity = "1";
    });

    cell.addEventListener("mouseleave", () => {
      lightEffect.style.opacity = "0";
      cell.style.borderImage = "none";
    });

    cell.addEventListener(
      "mousemove",
      throttle((e: MouseEvent) => {
        const rect = cell.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        lightEffect.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;

        const gradientSize = 153;
        const borderGradient = `
          radial-gradient(
            circle ${gradientSize}px at ${x}px ${y}px,
            rgba(255, 83, 83, 0.5) 50%,
            rgba(255, 255, 255, 0.05) ${gradientSize}px
          ) 1
        `;

        requestAnimationFrame(() => {
          cell.style.borderImage = borderGradient;
        });
      }, 30)
    );

    cell.dataset.lightBound = "true";
  });
}

const mugaBentoWindow = window as MugaBentoWindow;

if (!mugaBentoWindow.__mugaBentoGridBound) {
  document.addEventListener("astro:page-load", applyLightEffect);
  document.addEventListener("DOMContentLoaded", applyLightEffect);
  mugaBentoWindow.__mugaBentoGridBound = true;
}

applyLightEffect();
