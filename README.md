# A module for d3 visualization of layered dependencies

## Terms

Component: A Component represents some entity which can be somewhere along the axis of low level to high level abstraction.

Layer: A Layer is a group of Components at the same abstraction layer.  A group of high level components or a group of low level components.  The layer has a type indicator which classifies all the Components in the layer.

Stack:  A Stack represents a set of abstraction Layers that need to interface together to produce one part of a multiple part solution.

Solution: A System is a set of stacks that together provide a solution to multiple users.

Components dependencies:  In a layer Components may have dependencies on other Components.  

InterLayer dependencies : Components across layers may have dependency relationships

Cross stack relationships : Components in stacks can link through to components in equivalent layers in other stacks to establish cross stack services.

Extension:  Nodes from the stacks can extend to a common interconnect in order to form a connected graph.

Provisioning: This relates to the action of selecting components from layers either by the user or by the business logic.

![alt text][logo]

[logo]: images/domain.png "Solution Domain Model"


## How to use

To create a visualization you need to pass in a solution factory function and provide options
~~~
const visualization = vis.createVisualization(solutionFactory,options);
~~~

The solution factory function needs to return an array of Stacks.
~~~
let modelFactory = function(){
  return [stack1,stack2];
}
~~~

Each Stack should contain a stack number, name and array of layers.
~~~
var stack1 = {
  stackNumber: 0,
  stackName: "Test",
  layers: [ usersLayer, servicesLayer ],
}
~~~

Each Layer should have a name, type and array of Component nodes and transform metadata
~~~
var usersLayer = {
    name: "user",
    type: "User",
    data:  [userCat1,user1],
    transform: { name: "userCustomer",cx: 1, cy:1,anchor: "middle", style: "user", fixed: true } };
~~~

Component nodes must have an id,name and parent.
~~~
var userCat1={ "id": "userCategory", name: "usersCategory", parent: "null"};
var user1 = { "id": "user1", name: "aCustomer", parent: "userCategory"};
~~~

Components are  managed in Data Nodes that represent the position of the component and additional metadata
~~~
var extensionId = "network"
var extensionComponent = { "id": extensionId, name="Extension" };
var extensionData = {
  data: extensionComponent,
  fx: width/2, //fixed x
  fy: height, //fixed y
  fixed: true  //The node is a fixed position
}
~~~

Layers can also have a set of dependencies
~~~
var servicesLayer ={
  name: "services",
  type: "Service",
  components: [servicecat1,service1 ,service2],
  transform: ...,
  dependencies: [ service1_dependsupon_service2 ]}
~~~

Each Dependency describes a Dependency from source Component to target Component.
~~~
var service1_dependsupon_service2 = { "source": "service1", "target": "service2", "type": "Dependency" };
~~~


Define an extension factory
~~~

function extensionFactory(node/*a single node*/,nodeHash/*a map of node id to node*/){
    if(<logic>){
      return extensionData;
    }
  return null;
}
~~~

Define an inter layer link factory which returns links between components in different layers.
~~~
function interLayerLinkFactory(node1,node2){
  return {
    source: <source component id>,
    target: <target component id>
  }
}
~~~

###  Processing

After a component is selected
dependencies from all selected nodes are determined and those components are Provisioned.

Within each Stack the set of Provisioned nodes is then iterated and the
inter layer link factory is invoked to provide links between layers.

Finally pairs of provisioned components between stacks and in identical layers are iterated and the cross stack link factory function is invoked to provide links between stacks.

### Visualization

Options can be passed when creating the visualization but default to the following
~~~
var defaultOptions = {
  domId: "layered-visualization",//TOOD
  width:1200,
  height:800,
  nodesize: 20
}
~~~


### Layer Transforms

Data Nodes are initially rendered to the UI according to the transform defined in the layer.

The transform cx,cy properties define the center of the layer components in the view.
The transform style properties define a css style that can be used to style the components in that layer.
The transform fixed property can specify a components doesnt float around the view.
The transform anchor property determines the position of the text anchor for the component name.
~~~
{
  name: "userCustomer",
  cx: 8*nodesize,
  cy:8*nodesize,
  anchor: "middle",
  style: "serviceUser",
  fixed: true
}
~~~

### Example

In this sample there are couple of users, devices, services and locations at a customer along with partner sites.
As items are selected the dependencies and interrelationships result in emergent diagram.

![alt text][example]

[example]: images/animation.gif "Sample animation"
