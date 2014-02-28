
function GraphMatcher(graph, pattern) {

    function match() {
        var candidatesPerPatternPart = findLinksWithMatchingStartAndEndLabels();

        if (candidatesPerPatternPart
                .map(function(d) {return d.length > 0;})
                .reduce(and, true)) {

            var combn = combinations(candidatesPerPatternPart);

            console.log("Calculated " + combn.length + " combinations for [" 
                + candidatesPerPatternPart.map(function(d){return d.length;}) 
                + "] with " + graph.nodes.length + " nodes and " + graph.links.length + " rels");

            return combn.filter(combinationMatchesPattern);
        }
        return [];
    }

    function checkInMapping(mapping, node, pnode) {
        var mappedSource = mapping[pnode.index];
        if (mappedSource === undefined) {
            mapping[pnode.index] = node;
        return true;
        }
        return mappedSource == node;
    }

    function combinations(categories) {
        var firstCat = categories[0].map(function(d) {return [d];});
        if (categories.length == 1) return firstCat;
        var restResult = combinations(categories.slice(1, categories.length));
        return firstCat.map(function(firstCatElem) {
            return restResult.map(function (d) {return firstCatElem.concat(d);});
        }).reduce(function(a,b) {return a.concat(b);}, []);
    }

    function findLinksWithMatchingStartAndEndLabels() {
        return pattern.links.map(function(pLink) {
            return graph.links.filter(function(link) {
                return link.source.label == pLink.source.label && 
                    link.target.label == pLink.target.label;
            });
        });
    }

    function combinationMatchesPattern(comb) {
        if (!isUnique(comb)) return false; 
        var mapping = {};
        return comb.map(function(rel, i) {
            return checkInMapping(mapping, rel.source, pattern.links[i].source)
                && checkInMapping(mapping, rel.target, pattern.links[i].target);
        }).reduce(and, true)
    }

    function isUnique(list) {
        if (list.length < 2) return true;
        var rest = list.slice(1, list.length);
        if (!isUnique(rest)) return false;
        for (var i = 0; i < rest.length; i++) {
            if (rest[i] == list[0]) return false;
        } 
        return true;
    }

    function and(a,b) {
        return a && b;
    }

    return {
        match: match,
        c: combinations
    };
}