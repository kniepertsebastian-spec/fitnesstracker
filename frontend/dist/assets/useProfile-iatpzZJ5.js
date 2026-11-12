import{c as i,b as t}from"./index-C8Q0QNOG.js";import{u as o,a as s,b as u}from"./vendor-query-Cd2ymKMt.js";/**
 * @license lucide-react v1.54.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const a={name:"trash",size:24,node:[["path",{d:"M10 11v6",key:"nco0om"}],["path",{d:"M14 11v6",key:"outv1u"}],["path",{d:"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6",key:"miytrc"}],["path",{d:"M3 6h18",key:"d0wm0j"}],["path",{d:"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",key:"e791ji"}]],aliases:["trash-2"]};a.node;const L=i(a);function c(){return t("/profile")}function h(e){return t("/profile",{method:"PUT",body:e})}const n=["profile"],l={MALE:"Männlich",FEMALE:"Weiblich"},p={SEDENTARY:"Kaum Bewegung",LIGHT:"Leicht aktiv (1-3x/Woche)",MODERATE:"Mäßig aktiv (3-5x/Woche)",ACTIVE:"Sehr aktiv (6-7x/Woche)",VERY_ACTIVE:"Extrem aktiv + körperliche Arbeit"},y={CUT:"Abnehmen",MAINTAIN:"Halten",BULK:"Aufbauen"};function f(){return o({queryKey:n,queryFn:c})}function T(){const e=s();return u({mutationFn:r=>h(r),onSuccess:()=>e.invalidateQueries({queryKey:n})})}export{p as A,l as G,y as N,L as T,T as a,f as u};
