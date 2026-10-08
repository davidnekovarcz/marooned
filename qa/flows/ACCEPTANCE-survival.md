# Marooned — survival Kaloko flows

These walks use `?qa=1`, which exposes `window.__maroonedQa` (teleport, give, needs, weather). Without that query the API is absent. Each run opens a fresh `?room=` so a previous catch or lit hearth does not stick in Firebase.

## Fish (`survival-fish.yml`)

Stand on the wreck fishing pole, pick it up, move to a shore cell, fish. Expect hands to hold `fish`.

## Fire (`survival-fire.yml`)

Force a dry sky, give tinder, stand at the hut campfire, light it. Expect a lit hearth. Rain blocking is the inverse (`setRaining(true)` → “too wet to light”); this flow covers the success path.

## Death (`survival-death.yml`)

Set hunger and thirst to empty with a little health left so the real needs tick drains health. Expect `#death`.

## Later

Meet other players by the fire needs two browser sessions and a shared Firebase room. Not automated yet.
