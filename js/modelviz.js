var modelVizInstanceCounter = 0;
function ModelViz(settings, parent, patternParent, level, callback) {

    var instance = modelVizInstanceCounter++;

    var clicks = 0;
    var done = false;

    var scale = d3.scale.category10();

    var force = d3.layout.force()
        .charge(settings.forceCharge)
        .linkDistance(settings.forceDistance)
        .on("tick", tick)
        .size([settings.width, settings.height]);


    var patternForce = d3.layout.force()
        .charge(settings.patternForceCharge)
        .linkDistance(settings.patternForceDistance)
        .on("tick", patternTick)
        .size([settings.patternWidth, settings.patternHeight]);


    var realSvg = d3.select(parent || "body").append("svg")
        .attr("width", settings.width)
        .attr("height", settings.height)
        .attr("class", "gameSvg");
    var svg = realSvg
        .append("g")
            .call(d3.behavior.zoom().scaleExtent([0.2, 1]).on("zoom", zoom))
        .append("g");

    svg.append("rect")
        .attr("class", "overlay")
        .attr("width", settings.width)
        .attr("height", settings.height);

    var linkGroup = svg.append("g").attr("class", "links");
    var nodeGroup = svg.append("g").attr("class", "nodes");

    var patternSvg = d3.select(patternParent || "body").append("svg")
        .attr("width", settings.patternWidth)
        .attr("height", settings.patternHeight)
        .attr("class", "patternSvg");
    var patternGroup = patternSvg.append("g")
        .attr("class", "pattern")
        .attr("x", 20)
        .attr("y", 20);
    var patternLinkGroup = patternGroup.append("g").attr("class", "patternLinks");
    var patternNodeGroup = patternGroup.append("g").attr("class", "patternNodes");

    function zoom() {
        svg.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
    }


    var link, node, patternLink, patternNode;

    createMarker("end-marker-" + instance, "arrowhead", settings.nodeRadius);
    createMarker("end-marker-found-" + instance, "arrowheadFound", settings.nodeRadius);
    createMarker("pattern-end-marker-" + instance, "arrowhead", settings.patternNodeRadius);

    var model = {
        nodes: [],
        links: []
    };

    var numNodes = level.numNodes;
    var numLabels = level.numLabels;
    var randomNode = d3.scale.pow().range([0,numNodes-1]).exponent(0.5);
    var numRelsPerNode = d3.scale.pow().range(level.relsPerNode).exponent(0.5);
    model.nodes = d3.range(numNodes).map(function() {
        return {label: Math.floor(Math.random() * numLabels), rels: Math.floor(numRelsPerNode(Math.random()))};
    });
    model.nodes.slice(0, level.numVisible).forEach(function(d) {d._visible = true});
    model.links = [];
    
    var pattern = level.pattern;

    prepareModel(model);
    prepareModel(pattern);

    function prepareModel(m) {
        m.links.forEach(function(l) {
            if (typeof l.source === "number") l.source = m.nodes[l.source];
            if (typeof l.target === "number") l.target = m.nodes[l.target];
        });
    }

    function update() {

        var nodes = model.nodes.filter(function(n) {return n._visible;});
        var links = model.links.filter(function(l) {
            return l.source._expanded || l.target._expanded;
        });

        force
            .nodes(nodes)
            .links(links)
            .start();

        patternForce
            .nodes(pattern.nodes)
            .links(pattern.links)
            .start();

        link = linkGroup.selectAll(".link")
            .data(links)
            .style("stroke", linkStroke)
            .attr('marker-end', linkMarker);
        link.enter().append("line")
            .attr("class", "link")
            .style("stroke", linkStroke)
            .attr('marker-end', linkMarker);
        link.exit().remove();

        node = nodeGroup.selectAll(".node")
            .data(nodes)
            .style("fill", nodeColor)
            .style("stroke-dasharray", strokeDasharray)
            .style("stroke", nodeStroke);
        node.enter()
            .append("circle")
                .attr("class", "node")
                .attr("r", settings.nodeRadius)
                .style("fill", nodeColor)
                .style("stroke", nodeStroke)
                .style("stroke-dasharray", strokeDasharray)
                .on("click", expand)
                .call(force.drag);
        node.exit().remove();


        patternLink = patternLinkGroup.selectAll(".patternLink")
            .data(pattern.links);
        patternLink.enter().append("line")
            .attr("class", "patternLink")
            .attr('marker-end', "url(#pattern-end-marker-" + instance + ")");
        patternLink.exit().remove();

        patternNode = patternNodeGroup.selectAll(".patternNode")
            .data(pattern.nodes)
            .style("fill", nodeColor);
        patternNode.enter()
            .append("circle")
                .attr("class", "patternNode")
                .attr("r", settings.patternNodeRadius)
                .style("fill", nodeColor)
                .call(patternForce.drag);
        patternLink.exit().remove();

    }

    function expand(node) {
        if (node._expanded === true) return;
        node._expanded = true;
        clicks += 1;

        addLinksToNode(node);

        update();

        matchPattern(getActiveModel(), pattern);

        checkWalkoverCondition();

        update();
    }

    function addLinksToNode(node) {
        var numMissingLinks = node.rels - getNeighborLinks(node).length;
        if (numMissingLinks > 0) {
            connectNodeToNeighbors(node, numMissingLinks);
        }
        getNeighborLinks(node).forEach(function(link) {
            show(getOtherNode(node, link));
        });
    }

    function show(node) {
        node._visible = true;
    }

    function connectNodeToNeighbors(node, relCount) {
        for (var i = 0; i < relCount; i++) {
            var otherNode, newLink, tries = 0;
            do {
                otherNode = getRandomNode();
                newLink = {source: node, target: otherNode};
            } while (
                (tries++ < model.nodes.length) 
                && (
                    newLink.source == newLink.target 
                    || linkExistsBetween(node, otherNode)
                )
            );
            model.links.push(newLink);
        }
    }

    function linkExistsBetween(node1, node2) {
        return model.links.filter(function(link) {
            return (link.source === node1 && link.target === node2) 
                || (link.source === node2 && link.target === node1) 
        }).length > 0;
    }

    function getRandomNode() {
        var index = Math.floor(randomNode(Math.random()));
        return model.nodes[index];
    }

    function getNeighborLinks(node) {
        return model.links.filter(function(link) {
            return nodeHasLink(node, link);
        });
    }

    function getNeighborNodes(node) {
        return getNeighborLinks(node).map(function (link) {
            return getOtherNode(node, link);
        });
    }

    function nodeHasLink(node, link) {
        return getOtherNode(node, link) !== null;
    }

    function getOtherNode(node, link) {
        if (link.source === node) return link.target;
        if (link.target === node) return link.source;
        return null;
    }

    function nodeStroke(d) {
        return d.found ? "red" : "#444";
    }

    function nodeColor(d) {
        return scale(d.label);
    }

    function legendColor(d) {
        return scale(d);
    }

    function linkStroke(d) {
        return d.found ? "red" : "#999";
    }

    function linkMarker(d) {
        return d.found ? "url(#end-marker-found-" + instance + ")" : "url(#end-marker-" + instance + ")";
    }

    function strokeDasharray(d) {
        return d._expanded ? "0" : "2.5";
    }

    function createMarker(id, klass, radius) {
        svg.append('svg:defs')
            .append('svg:marker')
                .attr('viewBox', '0 -4 10 10')
                .attr('refX', 15+radius).attr('refY', 0)
                .attr('markerWidth', 7)
                .attr('markerHeight', 7)
                .attr("id", id)
                .attr('orient', 'auto')
                .append('svg:path')
                    .attr('d', 'M0,-4L10,0L0,4')
                    .attr('class', klass);
    }

    function tick(e) {
        link.attr("x1", function(d) { return d.source.x; })
            .attr("y1", function(d) { return d.source.y; })
            .attr("x2", function(d) { return d.target.x; })
            .attr("y2", function(d) { return d.target.y; });

        node.attr("cx", function(d) { return d.x; })
            .attr("cy", function(d) { return d.y; });
    }


    function patternTick(e) {
        patternLink.attr("x1", function(d) { return d.source.x; })
            .attr("y1", function(d) { return d.source.y; })
            .attr("x2", function(d) { return d.target.x; })
            .attr("y2", function(d) { return d.target.y; });

        patternNode.attr("cx", function(d) { return d.x; })
            .attr("cy", function(d) { return d.y; });
    }

    update();

    function destroy() {
        force.stop();
        patternForce.stop();
        realSvg.remove();
        patternSvg.remove();
    }

    function getActiveModel() {
        var activeModel = {};
        activeModel.nodes = model.nodes.filter(function(n) { return n._visible; });
        activeModel.links = model.links.filter(function(d) {
            return $.inArray(d.source, activeModel.nodes) >= 0 && $.inArray(d.target, activeModel.nodes) >= 0;
        });
        return activeModel;
    }

    function matchPattern(graph, pattern) {
        if (done) return;
        var match = new GraphMatcher(graph, pattern).match();
        if (match.length > 0) {
            match[0].forEach(function(r) {
                graph.nodes[r.source.index].found = true;
                graph.nodes[r.target.index].found = true;
                graph.links.filter(function(d) {
                    return d.source.index == r.source.index && d.target.index == r.target.index;
                }).forEach(function(d) {d.found = true;});
            });
            done = true;
            callback(true, clicks);
        }
    }

    function checkWalkoverCondition() {
        if (!done 
            && model.nodes.filter(function(d) {
                    return d._expanded;
                }).length 
                == model.nodes.filter(function(d) {
                    return d._visible;
                }).length) {
            callback(false, clicks);
        }
    }

    return {
        destroy: destroy
    }
}