---
name: formatting-indian-addresses
description: Formats Indian postal addresses into a clean, consistent layout with door number, street, area, city, district, state and 6-digit PIN code. Use when the user pastes a messy address, asks to clean up shipping labels, or mentions PIN codes, courier forms or delivery addresses in India.
---

# Formatting Indian addresses

Output each address as:

```
Name
Door no., Street
Area / Locality
City, District
State - PIN
```

- PIN codes are exactly 6 digits. Flag any other length instead of guessing.
- Keep landmarks ("Near bus stand") on the Area line.
- Spell out abbreviations: "Rd" → "Road", "St" → "Street".
