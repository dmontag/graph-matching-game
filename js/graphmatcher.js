
function GraphMatcher(graph, pattern) {

    function match() {
        var pGraph = processModel(graph);
        var pPattern = processModel(pattern);

        var candidatesPerPatternPart = findLinksWithMatchingStartAndEndLabels(pGraph, pPattern);
        // console.log(candidatesPerPatternPart);

        if (candidatesPerPatternPart
                .map(function(d) {return d.length > 0;})
                .reduce(function(a,b) {return a && b;})) {

            var combn = combinations(candidatesPerPatternPart);
            // console.log("combinations: " + JSON.stringify(combn));
            return combn.filter(function (comb) {
                var ok = true;
                var mapping = {};
                comb.forEach(function(rel, i) {
                    // console.log(i);
                    ok = ok 
                        && checkInMapping(mapping, rel.source, pPattern[i].source)
                        && checkInMapping(mapping, rel.target, pPattern[i].target);
                    // console.log(mapping);
                });
                return ok;
            });
        }
        return [];
    }

    function checkInMapping(mapping, node, pnode) {
        var patternSource = pnode;
        var relSource = node;
        var mappedSource = mapping[patternSource.index];
        if (mappedSource === undefined) {
            mapping[patternSource.index] = relSource;
        return true;
        }
        return mappedSource == relSource;
    }

    //////

    function combinations(categories) {
        if (categories.length == 1) return categories[0];
        var result = [];
        var firstCat = categories[0];
        var restResult = combinations(categories.slice(1, categories.length));
        for (var i = 0; i < firstCat.length; i++) {
            result = result.concat(
                restResult.map(function (d) {return [firstCat[i]].concat(d);}));
        }
        return result;
    }

    function processModel(model) {
        var pLinks = model.links.map(function(link) {
            return {
                source: link.source, 
                target: link.target, 
                sourceLabel: link.source.label, 
                targetLabel: link.target.label
            };
        });
        return pLinks;
    }

    function findLinksWithMatchingStartAndEndLabels(pGraph, pPattern) {
        return pPattern.map(function(pLink) {
            return pGraph.filter(function(link) {
                return link.sourceLabel == pLink.sourceLabel && 
                    link.targetLabel == pLink.targetLabel;
            });
        });
    }

    return {
        match: match,
        c: combinations
    };
}