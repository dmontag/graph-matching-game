var modelVizInstanceCounter = 0;
function ModelViz(settings, parent, patternParent, model) {

    var instance = modelVizInstanceCounter++;

    var clicks = 0;

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


    var svg = d3.select(parent || "body").append("svg")
        .attr("width", settings.width)
        .attr("height", settings.height)
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
        .attr("height", settings.patternHeight);
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

    svg.append('svg:defs')
        .append('svg:marker')
            .attr('viewBox', '0 -4 10 10')
            .attr('refX', 15+settings.nodeRadius).attr('refY', 0)
            .attr('markerWidth', 7)
            .attr('markerHeight', 7)
            .attr("id", "end-marker-" + instance)
            .attr('orient', 'auto')
            .append('svg:path')
                .attr('d', 'M0,-4L10,0L0,4')
                .attr('class', 'arrowhead');


    svg.append('svg:defs')
        .append('svg:marker')
            .attr('viewBox', '0 -4 10 10')
            .attr('refX', 15+settings.patternNodeRadius).attr('refY', 0)
            .attr('markerWidth', 7)
            .attr('markerHeight', 7)
            .attr("id", "pattern-end-marker-" + instance)
            .attr('orient', 'auto')
            .append('svg:path')
                .attr('d', 'M0,-4L10,0L0,4')
                .attr('class', 'arrowhead');


    if (model === undefined) {
        model = {
            nodes: [],
            links: []
        };

        var numNodes = 100;
        var numLabels = 3;
        var randomNode = d3.scale.pow().range([0,numNodes-1]).exponent(0.5);
        var numRelsPerNode = d3.scale.pow().range([2,6]).exponent(0.5);
        model.nodes = d3.range(numNodes).map(function() {
            return {label: Math.floor(Math.random() * numLabels), rels: Math.floor(numRelsPerNode(Math.random()))};
        });
        model.nodes[0]._visible = true;
        model.links = [];
    }


    var pattern = {
        nodes: [
            {label: 0},
            {label: 1},
            {label: 2}
        ],
        links: [
            {source: 0, target: 1},
            {source: 0, target: 2}
        ]
    };

    prepareModel(model);
    prepareModel(pattern);

    // console.log(model);

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
            .data(links);
        link.enter().append("line")
            .attr("class", "link")
            .attr('marker-end', "url(#end-marker-" + instance + ")");
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

        var numMissingLinks = node.rels - getNeighborLinks(node).length;
        if (numMissingLinks > 0) {
            connectNodeToNeighbors(node, numMissingLinks);
        }
        getNeighborLinks(node).forEach(function(link) {
            show(getOtherNode(node, link));
        });

        update();

        matchPattern(getActiveModel(), pattern);

        update();
    }

    function connectNodeToNeighbors(node, relCount) {
        for (var i = 0; i < relCount; i++) {
            var newLink;
            do {
                newLink = {source: node, target: getRandomNode()};
            } while (newLink.source == newLink.target || $.grep(model.links, function (d) {
                return d.source == newLink.source && d.target == newLink.target;
            }).length > 0);
            model.links.push(newLink);
        }
    }

    function getRandomNodeButNot(node) {
        var randomNode;
        do {
            randomNode = getRandomNode();
        } while (randomNode == node);
        return randomNode;
    }

    function getRandomNode() {
        // var index = Math.floor(Math.random() * model.nodes.length);
        var index = Math.floor(randomNode(Math.random()));
        return model.nodes[index];
    }

    function show(node) {
        node._visible = true;
        // var neighbors = getNeighborNodes(node);
        // var numExpandedNeighbors = neighbors.filter(function(node) { return node._expanded; }).length;
        // if (neighbors.length == numExpandedNeighbors) {
        //     node._expanded = true;
        // }
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

    function strokeDasharray(d) {
        return d._expanded ? "0" : "2.5";
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
        svg.remove();
    }

    function getActiveModel() {
        var activeModel = {};
        activeModel.nodes = model.nodes.filter(function(n) { return n._visible; });
        activeModel.links = model.links.filter(function(d) {
            return $.inArray(d.source, activeModel.nodes) >= 0 && $.inArray(d.target, activeModel.nodes) >= 0;
        });
        console.log(activeModel);
        return activeModel;
    }

    function matchPattern(graph, pattern) {
        console.log(graph);
        var match = new GraphMatcher(graph, pattern).match();
        if (match.length > 0) {
            console.log(match);
            match[0].forEach(function(r) {
                console.log("matched rel:");
                console.log(r);
                graph.nodes[r.source.index].found = true;
                graph.nodes[r.target.index].found = true;
            });
        }
    }

    return {
        destroy: destroy
    }
}