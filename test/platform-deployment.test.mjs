import test from 'node:test';
import assert from 'node:assert/strict';
import {template} from '../scripts/platform-template.mjs';
test('account infrastructure restricts origin invocation and preserves uncached identity requests',()=>{
 const r=template.Resources;
 assert.equal(r.FunctionUrl.Properties.AuthType,'AWS_IAM');
 assert.equal(r.OriginAccess.Properties.OriginAccessControlConfig.SigningBehavior,'always');
 for(const name of ['UrlPermission','InvokePermission']){
  assert.equal(r[name].Properties.Principal,'cloudfront.amazonaws.com');
  assert.match(r[name].Properties.SourceArn['Fn::Sub'],/distribution\/\$\{Distribution\}$/);
 }
 assert.equal(r.Distribution.Properties.DistributionConfig.DefaultCacheBehavior.OriginRequestPolicyId,'b689b0a8-53d0-40ab-baf2-68738e2966ac');
 assert.equal(r.Distribution.Properties.DistributionConfig.DefaultCacheBehavior.CachePolicyId,'4135ea2d-6df8-44a3-9df3-4b5a84be39ad');
 assert.equal(r.State.DeletionPolicy,'Retain');
 assert.equal(r.State.Properties.PointInTimeRecoverySpecification.PointInTimeRecoveryEnabled,true);
 assert.equal(r.State.Properties.GlobalSecondaryIndexes[0].IndexName,'kind-sort');
 assert.equal(r.Monitor.Properties.State,'DISABLED');
 assert.equal(template.Parameters.FormUrl.Default,'');
 for(const key of ['InternalSecret','FormsSecret','VaultKey'])assert.equal(template.Parameters[key].NoEcho,true);
});
