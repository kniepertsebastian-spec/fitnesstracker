import{c as i,a as c,b as r}from"./index-C8Q0QNOG.js";import{u as p,a,b as n}from"./vendor-query-Cd2ymKMt.js";/**
 * @license lucide-react v1.54.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const u={name:"camera",size:24,node:[["path",{d:"M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z",key:"18u6gg"}],["circle",{cx:"12",cy:"13",r:"3",key:"1vg3eu"}]]};u.node;const g=i(u);function h(){return r("/progress-photos")}function l(e,o){const s=new FormData;return s.append("file",e),o&&s.append("takenAt",o),c("/progress-photos",s)}function y(e){return r(`/progress-photos/${e}`,{method:"DELETE"})}const t=["progress-photos"];function m(){return p({queryKey:t,queryFn:()=>h().then(e=>e.items)})}function f(){const e=a();return n({mutationFn:({file:o,takenAt:s})=>l(o,s),onSuccess:()=>e.invalidateQueries({queryKey:t})})}function q(){const e=a();return n({mutationFn:o=>y(o),onSuccess:()=>e.invalidateQueries({queryKey:t})})}export{g as C,f as a,q as b,m as u};
