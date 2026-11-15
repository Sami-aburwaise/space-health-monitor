# Space Health Monitor — what it is, and the NASA problems it addresses

## What this application is

Space Health Monitor is a local health tool for a crew member who is not a doctor. They enter six indicators in chat — heart rate, blood pressure, fasting blood glucose, body temperature, sleep hours, and mood — plus blood oxygen when needed. The app classifies each reading as normal, watch, or alert, shows the worst status for the day, and says what to do, including when to contact the flight surgeon.

Readings stay in the browser. Status, alerts, and emergency steps are computed on the device, so the crew still gets guidance when the link to Earth is slow or down. The crew can set the location to a space station, a Moon base, a Mars habitat, or a surface rover. That changes how long a reply from Earth takes and how the app tells them to reach the flight surgeon.

Thresholds are illustrative. They are not medical advice and not NASA operational limits. The crew follows the flight surgeon.

## The problem it solves

On a long mission the crew has to notice changes in themselves. A flight surgeon may be seconds away on a station and up to about 48 minutes away at Mars. The app answers five questions a non-clinician needs:

1. What can I measure here, and how?
2. Why does this number matter in space?
3. Is today’s reading normal, worth watching, or an alert?
4. What do I do right now?
5. When do I contact the ground, and how, from this location?

A missing reading is shown as “not measured today.” It is not treated as normal. The same indicator on watch for 3 days becomes an alert. Two or more indicators on watch the same day are called out so the crew mentions them at the next flight-surgeon check-in.

## NASA’s five hazards, and how the app uses them

Source: NASA Human Research Program, 5 Hazards of Human Spaceflight — https://www.nasa.gov/hrp/hazards/

| Hazard | The problem NASA describes | What the app does about it |
| --- | --- | --- |
| Gravity fields | Weightlessness and partial gravity change the heart, blood flow, muscles, bones, and balance. | Heart rate and blood pressure explain fluid shift and loss of fitness, and tell the crew when to rest, re-measure, or call. Daily resistance exercise is the countermeasure the coach walks through. |
| Isolation and confinement | Months in a small crew, away from family, affect mood, sleep, and teamwork. | Sleep hours and a 1–5 mood check are logged every day. Low mood gets a talk-to-someone step. Mood of 1–2, or 3 for three days, says to contact the flight surgeon or crew psychologist. |
| Distance from Earth | Care, supplies, and advice get slower the farther the crew travels. | This is a design rule, not a vital sign. Guidance is stored on the device. Station, Moon, Mars, and rover each have their own “contact the flight surgeon” line, including the Mars case where a reply can take up to 48 minutes and the crew must follow onboard steps while they wait. |
| Hostile / closed environment | The cabin is a machine: air, temperature, noise, light, and microbes have to be controlled. | Temperature covers infection risk in a sealed cabin. SpO₂ tells the crew to check cabin oxygen and carbon dioxide. Sleep guidance covers light, noise, and a broken body clock. |
| Space radiation | Particle radiation outside Earth’s magnetic protection can harm cells and the immune system. | Named on body temperature, because radiation is one reason immune responses change. The app does not track dose. It does not replace a dosimeter. |

## NASA HRP risks the indicators are tied to

Source: NASA Human Research Roadmap — Risks — https://humanresearchroadmap.nasa.gov/risks/

| Indicator | HRP risk the app cites | Problem that risk names | What the crew is told to do |
| --- | --- | --- | --- |
| Heart rate | Cardiovascular adaptations; reduced cardiorespiratory and musculoskeletal fitness | The heart and vessels adapt to less gravity, and fitness drops, so resting and exercise heart rate change. | Rest, re-measure, ease exercise on watch. Stop, stay held in place, and call if resting rate is above 110 or below 40 bpm, or if there is chest pain, a skipping beat, dizziness, or fainting. |
| Blood pressure | Cardiovascular adaptations | Fluid shifts toward the head and blood-pressure control changes. Pressure can fall when gravity returns. | Re-measure and limit salt on watch. Call at 140/90 mmHg or higher, a top number below 80, or any reading with headache, chest pain, vision change, or weakness. |
| Blood glucose | Inadequate food and nutrition; medical conditions in mission | A fixed menu and less movement can blunt the response to insulin. Skipped meals and long shifts can cause lows. | Regular meals on a normal reading. Fast sugar and a re-test in 15 minutes if under 70 mg/dL. Tell the flight surgeon the same day if fasting glucose is 126 mg/dL or higher. |
| Body temperature | Altered immune response; medical conditions in mission | Immune responses change in flight, and an infection in a closed cabin can reach the whole crew. | Rest and re-check on watch. At 38.0 °C or higher, or below 35.0 °C, stop exercise, keep distance from crewmates, and contact the flight surgeon. |
| Sleep | Sleep loss, circadian desynchronization, and work overload; behavioral changes | A 90-minute sunrise on station, plus noise, light, and shifting schedules, cuts sleep. Short sleep slows reactions and judgment. | Protect the schedule on watch. Under 6 hours, or on watch three nights in a row, avoid safety-critical tasks if drowsy and tell the flight surgeon. |
| Mood | Adverse cognitive or behavioral changes and psychiatric disorders; inadequate teamwork | Isolation, confinement, and distance raise stress, loneliness, and conflict. Low mood affects sleep, teamwork, and safety. | Talk to a crewmate, family, or the coach on a score of 3. At 1 or 2, or three days at 3, book a private talk with the flight surgeon or crew psychologist. Thoughts of self-harm are an immediate call. |
| Blood oxygen (extra) | Hypoxia | Cabin air is manufactured. A leak, a fire, or a carbon-dioxide buildup can cut the oxygen the crew receives. | Re-measure on watch. At 92% or lower, or if short of breath, check cabin O₂ and CO₂ and contact the flight surgeon. |

## What it does not solve

- It does not diagnose disease and it does not replace the flight surgeon.
- It does not measure radiation dose, bone density, muscle mass, or eye and brain changes from fluid shift (SANS).
- It does not use real astronaut medical records. Readings are whatever the crew enters.
- Bands come from the challenge brief and public references (American Heart Association for blood pressure, American Diabetes Association for fasting glucose, CDC for sleep, MedlinePlus for fever and pulse oximetry). They are labeled illustrative in the app.
