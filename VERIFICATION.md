# Browser verification — 2026-09-06 20:21 (Africa/Windhoek)

Verified the built production app at http://127.0.0.1:5178 in Chromium, plus the development app during visual iteration.

| Requirement | Observed result |
| --- | --- |
| Build | `npm run build` passed TypeScript and Vite. Main JS is approximately 133 KB gzip; Vite reports its standard 500 KB uncompressed chunk-size advisory. |
| Black hole and disk | Inspected desktop, mobile, close-approach, and overhead screenshots. Dark shadow, lensed upper/lower disk images, bright filaments, stars, and surrounding haze render. Zero shader errors. |
| Guided voyage | Reached 100% at 7.6485 horizon radii using the UI's 5× speed. End-of-approach message displayed. |
| Pause | Simulation time and voyage progress remained unchanged while paused. |
| Free flight | W moved the camera toward the hole; switching from voyage preserved heading. |
| Orbit | Drag changed camera position while preserving radius within 0.01 units. |
| Viewpoints | Overhead reached (0,22,12), deep space 52.469 radii, and photon-ring viewpoint 7.086 radii. Disk-edge preset also exercised. |
| Scene controls | Exposure, disk brightness, atmosphere, time speed, and FOV updated their values. High quality rendered at 1536×864. |
| Lensing/disk switches | With time stopped, canvas images changed when lensing was disabled and disk brightness set to zero. |
| Touch layout | Inspected at 390×844, with no horizontal overflow. Touch forward control reduced camera distance. |
| Audio | Explicit enable changed to the active/mute state; mute returned to off. No runtime errors. Audio quality was not assessed by human listening. |
| Image export | Camera button produced a PNG download with the expected dated filename. |
| Guide and clean view | Native guide opened and closed with Escape; hide/show interface worked. |
| Fullscreen | Entered and exited fullscreen successfully. |
| Reduced motion | Initial time stayed at zero and paused; explicitly beginning the approach resumed motion. |
| Runtime | Browser console contained no errors. Typical observed frame rate was roughly 32–50 FPS in this browser at desktop test resolutions; hardware and scene position affect performance. |

Desktop screenshot: `artifacts/desktop.png`. The visual style is an original interpretation inspired by Interstellar, and the limitations of the approximate Schwarzschild model are described in README.md and the in-app guide.
