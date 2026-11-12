import{c as s,o as n,p as i,q as u}from"./index-C8Q0QNOG.js";import{u as c,a,b as t}from"./vendor-query-Cd2ymKMt.js";import{C as d}from"./usePlanExercises-C0JDTmCm.js";/**
 * @license lucide-react v1.54.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const r={name:"plus",size:24,node:[["path",{d:"M5 12h14",key:"1ays0h"}],["path",{d:"M12 5v14",key:"s699le"}]]};r.node;const g=s(r),l=["cardio-logs","week"];function L(){return c({queryKey:l,queryFn:()=>u().then(o=>o.items)})}function q(){const o=a();return t({mutationFn:e=>i({...e,clientId:e.clientId??crypto.randomUUID(),performedAt:e.performedAt??new Date().toISOString()},`Cardio · ${d[e.machine]}`),onSuccess:()=>o.invalidateQueries({queryKey:["cardio-logs"]})})}function f(){const o=a();return t({mutationFn:e=>n(e),onSuccess:()=>o.invalidateQueries({queryKey:["cardio-logs"]})})}export{g as P,f as a,q as b,L as u};
