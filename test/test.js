var assert = require('assert');

var vis = require("../src/main/js/vis.js");

var selectionFunction=(n)=> n.data.selected ? true: false;

var serviceConstraint={ "id": "requires"};

var userLayerType ="User";
var userCat1={ "id": "userCategory", name: "usersCategory", parent: "null"};
var user1 = { "id": "user1", name: "aCustomer", parent: "userCategory", layerType: userLayerType};
var user1Node = { data: user1 };
var usersLayer = { name: "user", type:userLayerType, components:  [userCat1,user1], transform: { name: "userCustomer",cx: 1, cy:1,anchor: "middle", style: "user", fixed: true } };

var serviceLayerType ="Service";
var servicecat1={ "id": "servicecat1", name: "aServiceCat", parent: "null"};
var service1 = { "id": "service1", name: "aService1", parent: "servicecat1", layerType: serviceLayerType};
var service1Node = { data: service1 };
var service2 = { "id": "service2", name: "aService2", parent: "servicecat1", layerType: serviceLayerType};  
var service2Node = { data: service2 };
var service3 = { "id": "service3", name: "aService3", parent: "servicecat1",layerType: serviceLayerType};  
var service3Node = { data: service3 };

var extensionId = "extension";
var extension = { "id": extensionId, "name": "extension" };  
var extensionNode = { data: extension };
function extensionFactory(node,nodeHash){
    if(node.data.id==='service3' && !nodeHash[extensionId]){
      return extensionNode;
    }
  return null;
}

var service1_dependsupon_service2 = { "source": "service1", "target": "service2", "type": "Dependency" };
var service2_dependsupon_service1 = { "source": "service2", "target": "service1", "type": "Dependency" };
var service2_dependsupon_service3 = { "source": "service2", "target": "service3", "type": "Dependency" };
var service1_dependsupon_service3 = { "source": "service1", "target": "service3", "type": "Dependency" };

var servicesLayer ={ name: "service", type:"Service",components:  [servicecat1,service1 ,service2], transform: { name: "serviceCustomer",cx: 1, cy:1,anchor: "middle", style: "service", fixed: false },
                    dependencies: [ service1_dependsupon_service2 ]}

var constraints = [
  {
    source: serviceConstraint.id,
    sourcename: "TestConstraint",
    target: user1.id,
    type: "Association"
  },
  {
    source: serviceConstraint.id,
    sourcename: "TestConstraint",
    target: service1.id,
    type: "Dependency"
  }
]

var emergentConstraints = [
]

function crossStackLinkFactory(node,node2){    
      return {source: node, target:node2};
}

var stacks = [{
      stackNumber: 0,
      stackName: "Stack0",
      constraints: [],
      layers: [ usersLayer, servicesLayer ],
    },{
      stackNumber: 1,
      stackName: "Stack1",
      constraints: [],
      layers: [ usersLayer, servicesLayer ],
    }] 

let solutionFactory = function(){
  return {    
    emergentConstraints,
    stacks 
  };
}


let visualization = vis.createVisualization(solutionFactory,{width:100,height:100});

//Does the list of hierarchyNodes contain a node with a specific id
function contains(ls = [], id){
  var ans = false;
  ls.forEach(function(item){    
    if(item.data.id===id)
      ans=true;
  })
  return ans;
}

describe('Given a stack with 2 layers (user and service)', function() {  
  
  let stack= visualization.getStacks()[0];
  let stack1 = visualization.getStacks()[1];

  visualization.setSelectionFunction(selectionFunction);  
    
  beforeEach(function(){
    
    
    user1['selected']=false;
    service1['selected']=false;
  })

  describe('When the visualizaiton is created', function() {                
      var layers,layer,components,componentNodes,componentNode;
      before(function(){  
        layers = stack.getLayers();             
        layer = layers[0];
        components = layer.getComponents();
        componentNodes = layer.getComponentNodes();
        componentNode = componentNodes[0];
      })    
      it('Then there are 2 layers', function() {      
          assert.equal(layers.length,2 );
      });
      it('Then the first layer has 2 components', function() {      
        assert.equal(componentNodes.length,1 );
      });
      it('Then a component has its type denormalized from the layer type', function() {              
        assert.equal(componentNode.data.layerType,layer.type);
      });
    });

  describe('When we request provisioning and there is user1 node selected ', function() {    
    var provisioned;
    before(function(){
      user1['selected']=true;      
      provisioned = stack.provision([user1Node,service1Node]);  
    })    
    it('Then provisioned nodes should contain user1', function() {      
        assert.equal(contains(provisioned.nodes,"user1"), true );
    });
    it('And  provisioned nodes should not contain service1', function() {      
        assert.equal(contains(provisioned.nodes,"service1"), false );
    })
    it('And the links should be empty', function() {      
        assert.equal(provisioned.links.length, 0 );
      });
  });
  describe('When we request provisioning and the service1 node is selected and there is a dependency between service1 and service2', function() {  
    var provisioned;
    before(function(){
      service1['selected']=true;
      provisioned = stack.provision([user1Node,service1Node, service2Node],[service1_dependsupon_service2]);
    })    
    it('Then a link should be returned and service1 and service2 should be in the node returned', function() {
      assert.equal(contains(provisioned.nodes,"service1"), true );
      assert.equal(contains(provisioned.nodes,"service2"), true );
      assert.equal(provisioned.links.length, 1 );
    })
  })

  describe('When there are multiple nodes and dependencies but no nodes are selected', function() {  
    var provisioned;
    before(function(){  
      provisioned = stack.provision([user1Node,service1Node, service2Node],[service1_dependsupon_service2]);
    })    
    it('Then no nodes or links should be returned', function() {
      assert.equal(contains(provisioned.nodes,"service2"), false );
      assert.equal(provisioned.links.length, 0 );
    })
  })

  describe('When the service1 node is selected and a dependencies exists from service2 to service1', function() {  
    var provisioned2;
    before(function(){
       service1['selected']=true;
      provisioned2 = stack.provision([service1Node, service2Node],[service2_dependsupon_service1]);
    })    
    it('Then there should no link', function() {
      assert.equal(contains(provisioned2.nodes,"service2"), false );      
      assert.equal(provisioned2.links.length, 0 );
    })
  })
  describe('When there are chained dependencies', function() {  
    var provisioned3;
    before(function(){
       service1['selected']=true;
      provisioned3 = stack.provision([user1Node,service1Node, service2Node, service3Node],[service1_dependsupon_service2, service2_dependsupon_service3]);
    })    
    it('Then nodes and links from the chain are returned', function() {
      assert.equal(contains(provisioned3.nodes,"service3"), true );
      assert.equal(provisioned3.links.length, 2 );
      assert.equal(contains(provisioned3.nodes,extensionId), false );
    })
  })
  describe('When an extension factory is defined', function() {  
    var provisioned4;
    before(function(){
      service1['selected']=true;
      provisioned4 = stack.provision([service1Node, service2Node, service3Node],[service1_dependsupon_service2, service2_dependsupon_service3],selectionFunction,extensionFactory);
    })    
    it('Then extension nodes and links are generated', function() {
      assert.equal(contains(provisioned4.nodes,extensionId), true );
      assert.equal(3,provisioned4.links.length);
    }) 
  })
  describe('When there are multiple dependencies from a node', function() {  
    var provisioned5
    before(function(){
      service1['selected']=true;
      provisioned5 = stack.provision([service1Node, service2Node, service3Node],[service1_dependsupon_service2, service1_dependsupon_service3]);
    })
    it('Then all dependent nodes and links are returned', function() {       
      assert.equal(contains(provisioned5.nodes,"service1"), true );
      assert.equal(contains(provisioned5.nodes,"service2"), true );
      assert.equal(contains(provisioned5.nodes,"service3"), true );
      assert.equal(provisioned5.links.length, 2 );      
    })
  })

  //  describe('When a inter layer link factory is defined and there are nodes from different layers', function() {  
  //   var provisioned;
  //   before(function(){
  //     user1['selected']=true;
  //     service1['selected']=true;
  //     provisioned = stack.provision([user1Node,service1Node],[],selectionFunction,null);
  //   })    
  //   it('Then links between the layers should be returned', function() {
  //     assert.equal(contains(provisioned.nodes,"service1"), true );
  //     assert.equal(provisioned.links.length, 1 );
  //   })
  // })

  describe('When a inter layer constraints link factory is defined and there are nodes from different layers', function() {  
    var provisioned;
    before(function(){
      user1['selected']=true;
      service1['selected']=true;
      provisioned = stack.provision([user1Node,service1Node],[],selectionFunction,null);
    })    
    it('Then links between the layers should be returned', function() {
      assert.equal(contains(provisioned.nodes,"service1"), true );
      assert.equal(provisioned.links.length, 1 );
    })
  })

  describe('When cross stack link function is defined', function() {  
    var provisioned,provisioned1;
    before(function(){
      user1['selected']=true;         
      stack.nodeClicked(user1Node);
      stack1.nodeClicked(user1Node);
    })    
    it('Then cross stack links emerge ', function() {      
      assert.equal(1,visualization.emergentlinks.length );
    })
  })

})
