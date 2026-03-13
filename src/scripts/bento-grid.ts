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

function applyLightEffect() {
  const bentoCells = document.querySelectorAll<BentoCellElement>(".bento-cell");

  bentoCells.forEach((cell) => {
    if (cell.dataset.lightBound === "true") return;

    const lightEffect = cell.querySelector<LightEffectElement>(".light-effect");
    if (!lightEffect) return;

    let cellRect = cell.getBoundingClientRect();
    let pointerX = 0;
    let pointerY = 0;
    let rafId: number | null = null;

    const updateCellRect = () => {
      cellRect = cell.getBoundingClientRect();
    };

    const renderLightEffect = () => {
      rafId = null;

      lightEffect.style.transform = `translate(${pointerX}px, ${pointerY}px) translate(-50%, -50%)`;

      const gradientSize = 153;
      const borderGradient = `
        radial-gradient(
          circle ${gradientSize}px at ${pointerX}px ${pointerY}px,
          rgba(255, 83, 83, 0.5) 50%,
          rgba(255, 255, 255, 0.05) ${gradientSize}px
        ) 1
      `;

      cell.style.borderImage = borderGradient;
    };

    cell.addEventListener("mouseenter", () => {
      updateCellRect();
      lightEffect.style.opacity = "1";
    });

    cell.addEventListener("mouseleave", () => {
      lightEffect.style.opacity = "0";
      cell.style.borderImage = "none";
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    });

    cell.addEventListener("mousemove", (event: MouseEvent) => {
      pointerX = event.clientX - cellRect.left;
      pointerY = event.clientY - cellRect.top;

      if (rafId === null) {
        rafId = requestAnimationFrame(renderLightEffect);
      }
    });

    window.addEventListener("resize", updateCellRect, { passive: true });
    window.addEventListener("scroll", updateCellRect, { passive: true });

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
