import {
  CLOTHES_TONES,
  SKIN_TONES,
  loadSavedCharacter,
  randomCharacter,
  randomName,
  type Character,
  type Gender,
} from "./appearance";

function hexCss(n: number): string {
  return `#${n.toString(16).padStart(6, "0")}`;
}

function swatches(root: HTMLElement, tones: readonly number[], current: number, onPick: (n: number) => void): void {
  root.replaceChildren();
  for (const tone of tones) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "swatch";
    btn.style.background = hexCss(tone);
    btn.setAttribute("aria-pressed", tone === current ? "true" : "false");
    btn.addEventListener("click", () => {
      onPick(tone);
      for (const el of root.querySelectorAll(".swatch")) {
        el.setAttribute("aria-pressed", el === btn ? "true" : "false");
      }
    });
    root.append(btn);
  }
}

export function showCharacterSelect(): Promise<Character> {
  const overlay = document.getElementById("character");
  const titleEl = document.getElementById("character-title");
  const leadEl = document.querySelector(".character-lead");
  const nameEl = document.getElementById("character-name");
  const nameRoll = document.getElementById("character-name-roll");
  const genderEl = document.getElementById("character-gender");
  const skinEl = document.getElementById("character-skin");
  const clothesEl = document.getElementById("character-clothes");
  const playBtn = document.getElementById("character-play");
  const randomBtn = document.getElementById("character-random");
  if (
    !overlay ||
    !titleEl ||
    !(nameEl instanceof HTMLInputElement) ||
    !nameRoll ||
    !genderEl ||
    !skinEl ||
    !clothesEl ||
    !(playBtn instanceof HTMLButtonElement) ||
    !(randomBtn instanceof HTMLButtonElement)
  ) {
    throw new Error("Character select markup missing from index.html");
  }

  let draft: Character = loadSavedCharacter() ?? randomCharacter();

  const syncGender = () => {
    for (const btn of genderEl.querySelectorAll<HTMLButtonElement>("[data-gender]")) {
      btn.setAttribute("aria-pressed", btn.dataset.gender === draft.gender ? "true" : "false");
    }
  };

  const paint = () => {
    nameEl.value = draft.name;
    syncGender();
    swatches(skinEl, SKIN_TONES, draft.skin, (n) => {
      draft = { ...draft, skin: n };
    });
    swatches(clothesEl, CLOTHES_TONES, draft.clothes, (n) => {
      draft = { ...draft, clothes: n };
    });
  };

  titleEl.textContent = "Marooned";
  if (leadEl instanceof HTMLElement) leadEl.hidden = false;

  paint();
  overlay.hidden = false;
  nameEl.focus();

  return new Promise((resolve) => {
    const finish = (character: Character) => {
      overlay.hidden = true;
      nameEl.removeEventListener("input", onName);
      nameRoll.removeEventListener("click", onRoll);
      genderEl.removeEventListener("click", onGender);
      playBtn.removeEventListener("click", onPlay);
      randomBtn.removeEventListener("click", onRandom);
      nameEl.removeEventListener("keydown", onEnter);
      resolve(character);
    };

    const readName = () => {
      const name = nameEl.value.replace(/\s+/g, " ").trim().slice(0, 24);
      draft = { ...draft, name: name || randomName() };
      nameEl.value = draft.name;
    };

    const onName = () => {
      draft = { ...draft, name: nameEl.value.slice(0, 24) };
    };
    const onRoll = () => {
      draft = { ...draft, name: randomName() };
      nameEl.value = draft.name;
    };
    const onGender = (e: Event) => {
      const btn = e.target;
      if (!(btn instanceof HTMLElement)) return;
      const picked = btn.closest("[data-gender]");
      if (!(picked instanceof HTMLElement)) return;
      const gender = picked.dataset.gender === "female" ? "female" : "male";
      draft = { ...draft, gender: gender as Gender };
      syncGender();
    };
    const onPlay = () => {
      readName();
      finish(draft);
    };
    const onRandom = () => {
      finish(randomCharacter());
    };

    const onEnter = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onPlay();
      }
    };

    nameEl.addEventListener("input", onName);
    nameRoll.addEventListener("click", onRoll);
    genderEl.addEventListener("click", onGender);
    playBtn.addEventListener("click", onPlay);
    randomBtn.addEventListener("click", onRandom);
    nameEl.addEventListener("keydown", onEnter);
  });
}
