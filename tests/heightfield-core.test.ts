import assert from "node:assert/strict";
import test from "node:test";

import {H,W,generate,type HeightSettings} from "../lib/heightfield/core.ts";

const baseline:HeightSettings={frequency:4,octaves:6,persistence:.52,redistribution:1.05,sea:.5};

function checksum(values:Float32Array){
  let hash=2166136261>>>0;
  const bytes=new Uint8Array(values.buffer,values.byteOffset,values.byteLength);
  for(const byte of bytes)hash=Math.imul(hash^byte,16777619)>>>0;
  return hash>>>0;
}

test("v0.7 baseline output remains unchanged",()=>{
  const field=generate(481726,baseline);
  assert.equal(checksum(field.values),1471391727);
  assert.equal(field.land,31);
  assert.ok(Math.abs(field.min-0.2056825608210136)<1e-12);
  assert.ok(Math.abs(field.max-0.7265650219086217)<1e-12);
  assert.ok(Math.abs(field.mean-0.46266782064842815)<1e-12);
});

test("same seed and settings are deterministic",()=>{
  const a=generate(481726,baseline);
  const b=generate(481726,baseline);
  assert.equal(checksum(a.values),checksum(b.values));
});

test("different seeds produce different fields",()=>{
  const a=generate(481726,baseline);
  const b=generate(481727,baseline);
  assert.notEqual(checksum(a.values),checksum(b.values));
});

test("height values stay normalized",()=>{
  const field=generate(481726,baseline);
  for(const value of field.values)assert.ok(value>=0&&value<=1);
});

test("horizontal seam is continuous",()=>{
  const field=generate(481726,baseline);
  let maxDifference=0;
  for(let y=0;y<H;y++)maxDifference=Math.max(maxDifference,Math.abs(field.values[y*W]-field.values[y*W+W-1]));
  assert.ok(maxDifference<1e-7,`max seam difference: ${maxDifference}`);
});
