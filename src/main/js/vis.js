function createVisualization(modelFactory,options= { nodesize: 10,width:100,height:100}) {

  var d3 = require('d3');

  var combo = require('combinations-generator');

  const nodesize=options.nodesize;

  var margin=30, width = options.width, height = options.height;

  var chartWidth = width;
  var chartHeight = height/3;

  var svg;

  var stacks = [];  

  const model = modelFactory({nodesize: nodesize, width: width, height: height});

  function emerge(crossStackLinkFactory=()=>null){
    var links = [];
    Object.keys(this.layerTypeHash).forEach(function(layerType){
      var layerTypeFilter = function(n){
        return n.layerType === layerType
      }

      stacks.forEach(function(stack,index){
        if(index<stacks.length-1){
          var stackNodes = stack.getProvisionedNodes().filter(layerTypeFilter);
          var nextStackNodes = stacks[index+1].getProvisionedNodes().filter(layerTypeFilter);
          var combinations = cartesian(stackNodes,nextStackNodes);
          combinations.forEach(function(pair=[]){
            links.push(crossStackLinkFactory(pair[0],pair[1]))
          })
        }
      })
    })
    return links;
    
  };

  var render = function(){
    svg = d3.select("#e2e").append("svg")
      .attr("width", chartWidth)
      .attr("height", height);

      svg.append("marker").attr("id","triangle")
        .attr("refX",12)
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
  var refresh = function(){
    stacks.forEach(function(stack){
      stack.refresh();
    })
  }
  var createStack = function(stackConfig){
    var nodeIndex={};
    var renderStack = function(svg){


      stackContext = svg.append("g").attr("nm",this.stackName);

      this.layers.forEach(function(layer){
        layer.context = stackContext.append("g").attr("nm",layer.name +"Context");
        layer.model.renderServices(layer.context);
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
      servicelinks: [],
      provisionedNodes: [],
      getLayers: function(){return this.layers},
      hashLayerTypes,
      allNodes,      
      allDependencies,
      getProvisionedNodes: function(){return this.provisionedNodes},
      renderStack,
      nodeClicked,
      provision,
      //buildServicelinks,
      tick,
      selectionFunction: null,
      extensionFactory: null,
      interLayerLinkFactory: null
    }
    Object.assign(stack,stackConfig);
    var simulation,simulation2=null;

    var createServices = function(layer) {
        var serviceTransform = layer.transform;
        var serviceHierarchy = layer.hierarchy = d3.stratify()
        .id(function(service){ return service.id;})
        .parentId(function(service){ return service.parent === "null" ? null : service.parent; })
        (layer.components);

        var nodes = serviceHierarchy.leaves();
        var links = serviceHierarchy.links();
        var interlinks = layer.dependencies ? interlinks(serviceHierarchy,layer.dependencies) : null;

        serviceHierarchy.each(function(n){nodeIndex[n.id]=n;})
        serviceHierarchy.each(function(n){n.fixed = serviceTransform.fixed})
        serviceHierarchy.each(function(n){
          n.layerType = layer.type})

        var renderServices = function(serviceContext){

            // Update the nodes…
            var node = serviceContext.selectAll(".node").data(nodes, function(d) {return d.id;  });
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
              // .call(d3.drag()
              //           .on("start", dragstarted)
              //           .on("drag", dragged)
              //           .on("end", dragended))
              .on("click",serviceClicked)
              .classed(serviceTransform.style,true)
            nodeg.append("text").text(function(d){ return d.data.name;}).attr("text-anchor",serviceTransform.anchor)

            if(interlinks){
              var interface = serviceContext.selectAll(".interface").data(interlinks, function(d) { return "interface-"+d.source.id+d.target.id;});
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

        var freeze = function() {
          console.log("Freeze"+layer.name)
          serviceHierarchy.each(function(n){
            n.fx  = n.x;
            n.fy  = n.y;
          })
        }

        var hierarchyTick2 = function() {
          var node = serviceContext.selectAll(".node").data(nodes, function(d) {return d.id;  });
          node.attr("transform", function(d) {
            return "translate(" + d.x + ", " + d.y + ")"; })

            if(interlinks){
              var interface = serviceContext.selectAll(".interface").data(interlinks, function(d) { return "interface-"+d.source.id+d.target.id;});
              interface.attr("x1", function(d) {
                  return d.source.x; })
                        .attr("y1", function(d) {   return (d.source.y); })
                        .attr("x2", function(d) {   return d.target.x; })
                        .attr("y2", function(d) { return (d.target.y); })
            }
        }

        d3.forceSimulation()
          .nodes(nodes)
          //.force(serviceTransform.name+"charge", d3.forceManyBody())
          .force(serviceTransform.name+"collide",d3.forceCollide(1.5*nodesize))
          .force(serviceTransform.name+"X",d3.forceX(serviceTransform.cx).strength(0.001))
          .force(serviceTransform.name+"Y",d3.forceY(serviceTransform.cy).strength(0.001))
          .force(serviceTransform.name+"Y",d3.forceCenter(serviceTransform.cx,serviceTransform.cy))
          .on("tick", hierarchyTick2)
          .on("end",freeze)
        }
        function serviceClicked(n){
            var nd = d3.select(this);
            var selected = !nd.classed("selected")
            nd.data.selected=selected;
            nd.classed("selected",selected);
            stack.nodeClicked(n,nd);            
            stack.solution.refresh();
        }
        function dragstarted(d) {
          if (!d3.event.active) {
            simulation.alpha(0.1).restart();
          }
          //d.fx = d.x;
          //d.fy = d.y;
          tick();
        }
        function dragged(d) {
            d.fx = d3.event.x;
            d.fy = d3.event.y;
            tick();
        }

        function dragended(d) {
            if (!d3.event.active) {
                simulation.alphaTarget(0.001).restart();
                simulation.restart();
              }
            d.fx = null;
            d.fy = null;
            tick();
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
        var layerObject =  { 
            renderServices, 
            getComponentNodes: function() {return nodes},
            getComponents: function() {return layer.components},
            hierarchy: serviceHierarchy, 
            dependencies: interlinks
        }
        Object.assign(layerObject,layer);
        return layerObject;
      }

      var layerobjects = [];
      
      stack.layers.forEach(function(layer){
          layerobjects.push(createServices(layer))
      })
      stack.layers = layerobjects;

      var allnodes = stack.allNodes();

      var stackContext,userContext,siteContext,deviceContext,serviceContext;

      var setupServiceForce = function(){
        var allnodes = stack.allNodes();
        simulation= d3.forceSimulation()
          .nodes(allnodes)
          .on("tick", function(){stack.tick()})

        // var allservices = allServices();
        // simulation2= d3.forceSimulation()
        //   .nodes([])
        //   .on("tick", tick)

      }
      setupServiceForce();

      function tick() {
        //console.log(stackname)
        if(this.servicelinks.links && this.servicelinks.links.length>0){
          var allnodes = stack.allNodes();
          var node = svg.selectAll('.node').data(allnodes, function(d) {return d.id;  });
          node.attr("transform", function(d) { return "translate(" + d.x + ", " + d.y + ")"; });

          var user = stackContext.selectAll(".user").data(this.servicelinks.links, function(d) { return "user-"+d.source.id+d.target.id;  });
          user.attr("x1", function(d) {return d.source.x; })
              .attr("y1", function(d) { return (d.source.y); })
              .attr("x2", function(d) { return d.target.x; })
              .attr("y2", function(d) { return d.target.y; })
              .attr("style","marker-end: url(#triangle)")
        }
      }

      function provision(nodes=[],dependencies=[],selected=(n)=> n.data.selected ? true: false,extension=()=>null,interLayerLinkFactory=()=>null){

        var selectionFn = this.selectionFunction ? this.selectionFunction : selected;
        var extensionFn = this.extensionFactory ? this.extensionFactory : extension;
        var interLayerLinkFactoryFn = this.interLayerLinkFactory ? this.interLayerLinkFactory : interLayerLinkFactory;

      
        var links = [];
        const nodeIndex = {};

        //Hash of all nodes
        nodes.forEach(function(node){
          nodeIndex[node.data.id]=node;
        });
            
      
        this.provisionedNodes= nodes.filter(selectionFn);//all selected nodes
        
        var linksHash = {};//The set of linsk
        var provisionedNodesHash = {};//The set of provisioned nodes

        var visited =[];
        this.provisionedNodes.forEach(function(node){
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

        var iterator = combo(linkedservicenodes,2);
        for (var item of iterator) {
          if(item[0].layerType!=item[1].layerType){
            var interlayerlink = interLayerLinkFactoryFn(item[0],item[1]);
            if(interlayerlink)
              links.push(interlayerlink);      
            }        
        }
        
        linkedservicenodes.forEach(function(node){
          if(!node.fixed){
            delete node.fx;
            delete node.fy;
          }
        })

        return { links: links, nodes: linkedservicenodes };
      }

      function nodeClicked(datanode,nd){
        this.servicelinks = this.provision(this.allNodes(),this.allDependencies(),this.selectionFunction,this.extensionFactory,this.interLayerLinkFactory)
        this.solution.emergentlinks = this.solution.emerge();
      }
        
      function refresh(){
        user = stackContext.selectAll(".user").data(this.servicelinks.links, function(d) { return "user-"+d.source.id+d.target.id;  });
        user.exit().remove();
        user.enter().insert("line", ".user")
            .attr("id", function(d){
              return "user-"+d.source.id+d.target.id;})
            .attr("class", "user")
            .attr("x1", function(d) { return d.source.x; })
            .attr("y1", function(d) { return (d.source.y); })
            .attr("x2", function(d) { return d.target.x; })
            .attr("y2", function(d) { return d.target.y; });

          var w = width/2*this.stackNumber + width/4;
          var h = height/2;
        
          simulation
          .nodes(this.servicelinks.nodes)
          .force("user", d3.forceLink(this.servicelinks.links).id(function(d) {return d.id }))
          //.force("charge", d3.forceManyBody())
          .force("collide",d3.forceCollide( function(d){ return 2*nodesize }))
          .force("center", d3.forceCenter(w, h));


          // simulation2
          // .nodes(servicelinks.nodes)
          // .force("center", d3.forceCenter(w, h));

            simulation.alpha(1).restart();
            //simulation2.alpha(1).restart();
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
  model.forEach(function(stackConfig){
    var stack = createStack(stackConfig);
    stacks.push(stack);    
  })
  
  var layerTypeHash = {}
  stacks.forEach(function(stack){
    stack.hashLayerTypes(layerTypeHash);
  })
  var solution = {
      emerge,
      render,
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
