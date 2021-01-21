const pulumi = require('@pulumi/pulumi');
const aws = require('@pulumi/aws');
const awsx = require('@pulumi/awsx');

const accelerator = new aws.globalaccelerator.Accelerator('example', {
  name: 'mbo-accelerator',
  enabled: true,
  ipAddressType: 'IPV4',
});

const listener = new aws.globalaccelerator.Listener('80', {
  acceleratorArn: accelerator.id,
  clientAffinity: 'SOURCE_IP',
  protocol: 'TCP',
  portRanges: [{
    fromPort: 80,
    toPort: 80,
  }],
});

const config = new pulumi.Config();

const europeInstance = new pulumi.StackReference(config.require('europeStack'));
const europeInstanceId = europeInstance.getOutput('instanceId');
const europeEndpoint = new aws.globalaccelerator.EndpointGroup('europe', {
  listenerArn: listener.id,
  healthCheckPath: '/',
  endpointGroupRegion: 'eu-central-1',
  endpointConfigurations: [{
    clientIpPreservationEnabled: true,
    endpointId: europeInstanceId,
    weight: 100,
  }],
});

const westInstance = new pulumi.StackReference(config.require('westStack'));
const westInstanceId = westInstance.getOutput('instanceId');
const westEndpoint = new aws.globalaccelerator.EndpointGroup('oregon', {
  listenerArn: listener.id,
  healthCheckPath: '/',
  endpointGroupRegion: 'us-west-2',
  endpointConfigurations: [{
    clientIpPreservationEnabled: true,
    endpointId: westInstanceId,
    weight: 100,
  }],
});


exports.publicDnsName = accelerator.dnsName;
exports.listenerId = listener.id;
