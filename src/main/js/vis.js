
function createVisualization(modelFactory,options= { nodesize: 10,width:100,height:100}) {

  var d3 = require('d3');

  var combo = require('combinations-generator');

  var constraintEngineFactory = require("constraints-engine");

  const nodesize=options.nodesize;

  var margin=30, width = options.width, height = options.height;
  var TRANSITION_DURATION = 500;

  var chartWidth = width;
  var chartHeight = height/3;

  var svg;

  var stacks = [];

  var emergentContext;

  const nodeIndex = {};//a cross stack index of all nodes

  const model = modelFactory({nodesize: nodesize, width: width, height: height});

  var tooltip;

  var emergentConstraintsEngine = constraintEngineFactory.compile(model.emergentConstraints,{explicit: true});

  function emerge(constraintsEngine,crossStackLinkFactoryFn=()=>null){  
    var crossStackLinkFactory = this.crossStackLinkFactory ? this.crossStackLinkFactory : crossStackLinkFactoryFn;

    var links = [];
    Object.keys(this.layerTypeHash).forEach(function(layerType){
      var layerTypeFilter = function(n){
        return n.data.layerType === layerType
      }
      var satisfiedFilter = function(n){        
        return n.data.satisfied!=undefined && n.data.satisfied
      }      

      stacks.forEach(function(stack,index){
        if(index<stacks.length-1){
          var stackNodes = stack.getProvisionedNodes().filter(layerTypeFilter).filter(satisfiedFilter);
          var nextStackNodes = stacks[index+1].getProvisionedNodes().filter(layerTypeFilter).filter(satisfiedFilter);
          var combinations = cartesian(stackNodes,nextStackNodes);
          combinations.forEach(function(pair=[]){            
            if(constraintsEngine.getConsistencyCheck(pair[0].data.id,pair[1].data.id).consistent){
              links.push(crossStackLinkFactory(pair[0],pair[1]))
            }            
          })
        }
      })
    })
    return links;
  };

  function hideTooltip() {
    tooltip.selectAll("*").remove();
    return tooltip.transition()
      .duration(TRANSITION_DURATION)
      .style("opacity", 0);
  }

  function showTooltip(node) {
    tooltip.text(node.data.name+ node.data.unsatisifiedConstraints);
    return tooltip
      .style("left", d3.event.pageX + "px")
      .style("top", d3.event.pageY - 15 + "px")
      .transition()
      .duration(TRANSITION_DURATION)
      .style("opacity", 1);
  }

  function mouseouted(node) {
    hideTooltip();
  }

  function mouseovered(node) {
    showTooltip(node);
  }

  var render = function(){
    d3.select("#e2e").select("svg").remove();
    svg = d3.select("#e2e").append("svg")
      .attr("width", chartWidth)
      .attr("height", height);

    tooltip = d3.select("#e2e").append("div").attr("id", "tooltip");

    emergentContext = svg.append("g").attr("nm","emergent");
    
      svg.append("marker").attr("id","triangle")
        .attr("refX",20)
        .attr("refY",6)
        .attr("markerWidth","13")
        .attr("markerHeight","13")
        .attr("orient","auto")
        .attr("markerUnit","strokeWidth")
        .append("path").attr("d","M2,2 L2,10 L8,6 L2,2").attr("style","fill: black")

        stacks.forEach(function(stack){
          stack.renderStack(svg);
        })
  }

  function renderEmergent(){
       var emergentlinkSelection = emergentContext.selectAll(".emergent").data(this.emergentlinks, function(d) { return "el-"+d.source.id+d.target.id;  });
        emergentlinkSelection.exit().remove();
        emergentlinkSelection.enter().insert("line", ".emergent")
        .attr("id", function(d){
          return "el-"+d.source.id+d.target.id;})
        .attr("class", "emergent")
        .attr("x1", function(d) { return d.source.x; })
        .attr("y1", function(d) { return (d.source.y); })
        .attr("x2", function(d) { return d.target.x; })
        .attr("y2", function(d) { return d.target.y; });
  }
  
  var provisionTick = function(){
    stacks.forEach(function(stack){
      stack.provisionTick();
    })

    var emergentlinkSelection = emergentContext.selectAll(".emergent").data(this.emergentlinks, function(d) { return "el-"+d.source.id+d.target.id;  });        
        emergentlinkSelection
        .attr("id", function(d){
          return "el-"+d.source.id+d.target.id;})
        .attr("class", "emergent")
        .attr("x1", function(d) { return d.source.x; })
        .attr("y1", function(d) { return (d.source.y); })
        .attr("x2", function(d) { return d.target.x; })
        .attr("y2", function(d) { return d.target.y; });


  }
  var createStack = function(stackConfig){

    var constraintsEngine = constraintEngineFactory.compile(stackConfig.constraints,{explicit: false});

    var renderStack = function(svg){

      stackContext = svg.append("g").attr("nm",this.stackName);

      this.layers.forEach(function(layer){
        layer.context = stackContext.append("g").attr("nm",layer.name +"Context");
        layer.renderLayer(layer.context);
      })
    }
    function hashLayerTypes(hash){
      this.layers.forEach(function(layer){
        hash[layer.type]=layer
      })
    }
    function allNodes(){
      var all = [];
      this.layers.forEach(function(layer){
        all = all.concat(layer.hierarchy.leaves())
      })
      return all;
    }
    function allDependencies(){
      var all = [];
      this.layers.forEach(function(layer){
        if(layer.dependencies)
          all = all.concat(layer.dependencies)
      })
      return all;
    }
    var stack = {
      hierarchies: [],
      provisioned: { links: [], nodes: [] },
      selectedNodes: [],
      getLayers: function(){return this.layers},
      hashLayerTypes,
      allNodes,
      allDependencies,
      getProvisionedNodes: function(){return this.provisioned.nodes},
      renderStack,
      provisionTick,
      nodeClicked,
      renderEmergent,
      provision,
      //buildprovisioned,
      selectionFunction: null,
      extensionFactory: null,
      constraintsEngine
    }
    Object.assign(stack,stackConfig);
    var simulation,simulation2=null;

    var createLayer = function(layerConfig) {
      var layerObject;

        var serviceTransform = layerConfig.transform;
        var serviceHierarchy = layerConfig.hierarchy = d3.stratify()
        .id(function(service){ return service.id;})
        .parentId(function(service){ return service.parent === "null" ? null : service.parent; })
        (layerConfig.components);

        var nodes = serviceHierarchy.leaves();
        var links = serviceHierarchy.links();
        var interlinks = layerConfig.dependencies ? interlinks(serviceHierarchy,layerConfig.dependencies) : null;

        serviceHierarchy.each(function(n){nodeIndex[n.id]=n;})
        serviceHierarchy.each(function(n){n.fixed = serviceTransform.fixed})
        serviceHierarchy.each(function(n){
          n.data.layerType = layerConfig.type})

        var renderLayer = function(serviceCtxt){
            this.serviceContext = serviceCtxt;
            // Update the nodes…
            var node = this.serviceContext.selectAll(".node").data(nodes, function(d) {return d.id;  });
            node.exit().remove();
            var nodeg = node.enter().append("g")
                .attr("transform", function(d) {
                  return "translate(" + d.x + ", " + d.y + ")"; })
                .attr("id",function(d){ return d.id; })
                .attr("class", "node")
            nodeg.append("circle")
              .attr("cx", function(d) { return 0; })
              .attr("cy", function(d) { return 0; })
              .attr("r", function(d) { return nodesize; })
              .call(d3.drag()
                        .on("start", dragstarted)
                        .on("drag", dragged)
                        .on("end", dragended))
              .on("mouseover", mouseovered)
              .on("mouseout", mouseouted)
              .on("click",componentClicked)
              .classed(serviceTransform.style,true)
            nodeg.append("text").text(function(d){ return d.data.name;}).attr("text-anchor",serviceTransform.anchor)

            if(interlinks){
              var interface = this.serviceContext.selectAll(".interface").data(interlinks, function(d) { return "interface-"+d.source.id+d.target.id;});
              interface.exit().remove();
              interface.enter().insert("line", ".node")
                  .attr("id", function(d){ return "interface-"+d.source.id+d.target.id;})
                  .attr("class", "interface")
                  .attr("x1", function(d) {return d.source.x; })
                  .attr("y1", function(d) {   return (d.source.y); })
                  .attr("x2", function(d) {   return d.target.x; })
                  .attr("y2", function(d) { return (d.target.y); })
                  .attr("style","marker-end: url(#triangle)")
            }

            var layer = this;
            d3.forceSimulation()
              .nodes(nodes)
              //.force(serviceTransform.name+"charge", d3.forceManyBody())
              .force(serviceTransform.name+"collide",d3.forceCollide(nodesize))
              .force(serviceTransform.name+"X",d3.forceX(serviceTransform.cx))
              .force(serviceTransform.name+"Y",d3.forceY(serviceTransform.cy))
              //.force(serviceTransform.name+"Y",d3.forceCenter(serviceTransform.cx,serviceTransform.cy))
              .velocityDecay(0.2)
              .on("tick", function(){ layer.componentTick() } )
              .on("end",function(){ layer.freeze()})
        }

         var freeze = function() {
              //console.log("Freeze"+this.name)
              this.hierarchy.each(function(n){
                n.fx  = n.x;
                n.fy  = n.y;
              })
              var node = this.serviceContext.selectAll(".node").data(nodes, function(d) {return d.id;  });
              node.classed("frozen",true);
          }

        var componentTick = function() {
          var node = this.serviceContext.selectAll(".node").data(nodes, function(d) {return d.id;  });
          node.attr("transform", function(d) {
            return "translate(" + d.x + ", " + d.y + ")"; })

            if(interlinks){
              var interface = this.serviceContext.selectAll(".interface").data(interlinks, function(d) { return "interface-"+d.source.id+d.target.id;});
              interface.attr("x1", function(d) {
                  return d.source.x; })
                        .attr("y1", function(d) {   return (d.source.y); })
                        .attr("x2", function(d) {   return d.target.x; })
                        .attr("y2", function(d) { return (d.target.y); })
            }
        }
        var componentClicked = function(n){
            var nd = d3.select(this);
            var selected = !nd.classed("selected")
            n.data.selected=selected;
            nd.classed("selected",selected);
            stack.nodeClicked(n,nd);
            stack.renderEmergent();
        }
        function dragstarted(d) {
          if (!d3.event.active) {
            simulation.alpha(0.1).restart();
          }
          d.fx = d.x;
          d.fy = d.y;
          //provisionTick();
          //simulation.restart()
        }
        function dragged(d) {
            d.fx = d3.event.x;
            d.fy = d3.event.y;            
            //stack.provisionTick();
        }
        function dragended(d) {
            if (!d3.event.active) {
                //simulation.alphaTarget(0.01).restart();
                //simulation.restart();
              }
            //d.fx = null;
            //d.fy = null;

        }
        function interlinks(nodeHierarchy,interrelationships){

          nodeHierarchy.each(function(n){
            nodeIndex[n.id]=n
          })
          var links = [];
          interrelationships.forEach(function(r){
            if(nodeIndex[r.source] && nodeIndex[r.target]){
              links.push({source: nodeIndex[r.source],
                          target: nodeIndex[r.target]})
            }else {
              //console.log("Ignoring link"+ JSON.stringify(r,null," "));
            }
          })
          return links;
        }
        layerObject =  {
            serviceContext: null,
            renderLayer,
            provisionTick,
            componentTick,
            freeze,
            getComponentNodes: function() {return nodes},
            getComponents: function() {return layerConfig.components},
            hierarchy: serviceHierarchy,
            dependencies: interlinks
        }
        Object.assign(layerObject,layerConfig);
        return layerObject;
      }

      var layerobjects = [];

      stack.layers.forEach(function(layer){
          layerobjects.push(createLayer(layer))
      })
      stack.layers = layerobjects;

      var allnodes = stack.allNodes();

      var stackContext,userContext,siteContext,deviceContext,serviceContext;

      var setupLayerForce = function(){
        var allnodes = stack.allNodes();
        simulation= d3.forceSimulation()
          .nodes(allnodes)
          .on("tick", function(){
            stack.solution.provisionTick()})
          .stop();
      }
      setupLayerForce();

      function provision(nodes=[],dependencies=[],selected=(n)=> n.data.selected ? true: false,extension=()=>null){

        var selectionFn = this.selectionFunction ? this.selectionFunction : selected;
        var extensionFn = this.extensionFactory ? this.extensionFactory : extension;

        var links = [];

        //Update the index of all nodes for nodes in this stack
        nodes.forEach(function(node){
          nodeIndex[node.data.id]=node;
        });

        this.selectedNodes= nodes.filter(selectionFn);//all selected nodes

        var linksHash = {};//The set of linsk
        var provisionedNodesHash = {};//The set of provisioned nodes

        var visited =[];
        this.selectedNodes.forEach(function(node){
          visited.push(node.data.id);
          provisionedNodesHash[node.data.id]=node;
        })

        function visit(ids,visited){
          if(ids.length==0)
            return;
          var targets= [];
          dependencies.forEach(function(interface){
            if(!linksHash[interface.source+interface.target]){
              var index = ids.indexOf(interface.source);
              if(index>=0){
                var s = nodeIndex[interface.source];
                var t = nodeIndex[interface.target]
                if(s && t){
                  provisionedNodesHash[s.data.id] = s;
                  provisionedNodesHash[t.data.id] = t;
                  links.push({ source: s, target: t});
                  linksHash[s.id+t.id]='a';
                  if(!visited.indexOf(interface.target)>=0){
                    targets.push(interface.target)
                    visited.push(interface.target);
                    var extensionNode = extensionFn(t,provisionedNodesHash);
                    if(extensionNode){
                        links.push({source: t, target: extensionNode})
                        visited.push(extensionNode.data.id);
                        provisionedNodesHash[extensionNode.data.id]=extensionNode;
                        nodeIndex[extensionNode.data.id]=extensionNode;
                    }
                  }
                }
              }
            }
          })
          visit(targets,visited);
        }
        visit(visited,visited.slice());

        var linkedservicenodes = [];
        Object.keys(provisionedNodesHash).forEach(function(key){
          linkedservicenodes.push(provisionedNodesHash[key]);
        })

        //use constraints to establish links between layers.
        this.constraintsEngine.reset();
        var iterator = combo(linkedservicenodes,2);
        for (var item of iterator) {
          if(item[0].data.layerType && item[1].data.layerType && item[0].data.layerType!=item[1].data.layerType){
            //console.log(item[0].data.name+":"+item[1].data.name)
            if(constraintsEngine.getConsistencyCheck(item[0].data.id,item[1].data.id).consistent){
              constraintsEngine.capture(item[0].data.id,item[1].data.id)
              links.push(
                 { source: item[0] , target: item[1] }
              );
            }
          }
        }

        //identify nodes whose constraints are all satisfied
        linkedservicenodes.forEach(function(node){
          node.data.satisfied=false;
          delete node.data.unsatisifiedConstraints;
          var satisfied = constraintsEngine.getSatisfied(node.data.id);
          if(satisfied.result){
            node.data.satisfied=true;
            //console.log("Satisfied"+node.data.name)
          }else {
            node.data.unsatisifiedConstraints = satisfied.unsatisifiedConstraints;
          }
        })

        linkedservicenodes.forEach(function(node){
          if(!node.fixed){
            delete node.fx;
            delete node.fy;
          }
        })

        return { links: links, nodes: linkedservicenodes };
      }

      function renderEmergent(){
        this.solution.renderEmergent();
      }

      function nodeClicked(datanode,nd){
        this.provisioned = this.provision(this.allNodes(),this.allDependencies(),this.selectionFunction,this.extensionFactory,this.interLayerLinkFactory)
        this.solution.emergentlinks = this.solution.emerge(this.solution.emergentConstraintsEngine);
      
        var w = width/2*this.stackNumber + width/4;
        var h = height/2;
        simulation
          .nodes(this.provisioned.nodes)
          .force("user", d3.forceLink(this.provisioned.links).id(function(d) {return d.id }))
          //.force("charge", d3.forceManyBody())
          .force("collide",d3.forceCollide( function(d){ return nodesize }))
          .force("center", d3.forceCenter(w, h));


          // simulation2
          // .nodes(provisioned.nodes)
          // .force("center", d3.forceCenter(w, h));

            simulation.alpha(1).restart();
            //simulation2.alpha(1).restart();
      }

      function provisionTick(){        
        var lyrs = this.layers;
        lyrs.forEach(function(layer){
          layer.componentTick();
        })

        if(this.provisioned.links && this.provisioned.links.length>0){
          var allnodes = stack.allNodes();
          var node = svg.selectAll('.node').data(allnodes, function(d) {return d.id;  });
          node.classed("satisfied",function(d){
              return d.data.satisfied
            })
            .attr("transform", function(d) { return "translate(" + d.x + ", " + d.y + ")"; });

          var user = stackContext.selectAll(".user").data(this.provisioned.links, function(d) { return "user-"+d.source.id+d.target.id;  });
          user.attr("x1", function(d) {return d.source.x; })
              .attr("y1", function(d) { return (d.source.y); })
              .attr("x2", function(d) { return d.target.x; })
              .attr("y2", function(d) { return d.target.y; })
              .attr("style","marker-end: url(#triangle)")
        }

        var user = stackContext.selectAll(".user").data(this.provisioned.links, function(d) { return "user-"+d.source.id+d.target.id;  });
        user.exit().remove();
        user.enter().insert("line", ".user")
            .attr("id", function(d){
              return "user-"+d.source.id+d.target.id;})
            .attr("class", "user")  //PJT
            .attr("x1", function(d) { return d.source.x; })
            .attr("y1", function(d) { return (d.source.y); })
            .attr("x2", function(d) { return d.target.x; })
            .attr("y2", function(d) { return d.target.y; });


      }

      return stack ;
    }

  function setSelectionFunction(f){
    stacks.forEach(function(stack){
      stack.selectionFunction =f;
    })
  }
  function setExtensionFactory(f){
    stacks.forEach(function(stack){
      stack.extensionFactory =f;
    })
  }
  function setInterLayerLinkFactory(f){
    stacks.forEach(function(stack){
      stack.interLayerLinkFactory =f;
    })
  }
  function setCrossStackLinkFactory(f){
    this.crossStackLinkFactory =f;
  }
  model.stacks.forEach(function(stackConfig){
    var stack = createStack(stackConfig);
    stacks.push(stack);
  })

  var layerTypeHash = {}
  stacks.forEach(function(stack){
    stack.hashLayerTypes(layerTypeHash);
  })
  var solution = {
      emergentConstraintsEngine,
      emergentlinks: [],
      emerge,
      render,
      renderEmergent,
      provisionTick,
      layerTypeHash,
      getStacks:  function() { return stacks},
      setSelectionFunction: setSelectionFunction,
      setExtensionFactory: setExtensionFactory,
      setInterLayerLinkFactory: setInterLayerLinkFactory,
      setCrossStackLinkFactory
    }

    stacks.forEach(function(stack){
      stack.solution = solution;
    })

    return solution;
}

function cartesian() {
    var r = [], args = Array.from(arguments);
    args.reduceRight(function(cont, factor, i) {
        return function(arr) {
            for (var j=0, l=factor.length; j<l; j++) {
                var a = arr.slice(); // clone arr
                a[i] = factor[j];
                cont(a);
            }
        };
    }, Array.prototype.push.bind(r))(new Array(args.length));
    return r;
}

module.exports = {
  createVisualization
}
