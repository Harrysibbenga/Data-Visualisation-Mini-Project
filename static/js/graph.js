queue()
    .defer(d3.csv, "data/Salaries.csv")
    .await(makeGraphs);

function makeGraphs(error, salaryData) {
    var ndx = crossfilter(salaryData);

    //  salary data that we've read in is treating the salaries as text because we're reading them from a CSV

    // converts the salaries to integers so we use a foreach loop on salary data and we set salary equal to an integer version of the salary
    // coverts data that is being trated as a string to a number. 
    salaryData.forEach(function(d) {
        d.salary = parseInt(d.salary);
        d.yrs_service = parseInt(d["yrs.service"]);
        d.yrs_since_phd = parseInt(d["yrs.since.phd"]);
    })

    show_gender_balance(ndx);
    show_discipline_selector(ndx);
    show_average_salaries(ndx);
    show_rank_distribution(ndx);

    show_percent_that_are_professors(ndx, "Female", "#percentage-of-female-professors");
    show_percent_that_are_professors(ndx, "Male", "#percentage-of-male-professors");

    show_years_of_service_and_salary(ndx);
    show_phd_to_salary(ndx);

    dc.renderAll();
}

function show_discipline_selector(ndx) {
    var dim = ndx.dimension(dc.pluck('discipline'));
    var group = dim.group();

    dc.selectMenu("#discipline-selector")
        .dimension(dim)
        .group(group);
}

function show_gender_balance(ndx) {
    var dim = ndx.dimension(dc.pluck('sex'));
    var group = dim.group();

    dc.barChart("#gender-balance")
        .width(400)
        .height(300)
        .margins({ top: 10, right: 50, bottom: 30, left: 50 })
        .dimension(dim)
        .group(group)
        .transitionDuration(500)
        .x(d3.scale.ordinal())
        .xUnits(dc.units.ordinal)
        .xAxisLabel("Gender")
        .yAxis().ticks(20);

    // we are counting the amount of rows we have fore each sex so we dont need to reduce

    // ordinal used because the dimesntion consists of male and female and then the y axis will be the count of how many of each they were.
}

function show_average_salaries(ndx) {
    var dim = ndx.dimension(dc.pluck('sex'));
    var average_salary_by_gender = dim.group().reduce(add_fact, remove_fact, initialise);

    // add a fact 
    function add_fact(p, v) {
        p.count++;
        p.total += v.salary;
        p.average = p.total / p.count;
        return p;
    }

    // remove a fact
    function remove_fact(p, v) {
        p.count--;
        if (p.count == 0) {
            p.total = 0;
            p.average = 0;
        }
        else {
            p.total -= v.salary;
            p.average = p.total / p.count;
        }
        return p;
    }

    // initialise the reducer
    function initialise() {
        return { count: 0, total: 0, average: 0 };
    }

    dc.barChart("#average-salary")
        .width(400)
        .height(300)
        .margins({ top: 10, right: 50, bottom: 30, left: 50 })
        .dimension(dim)
        .group(average_salary_by_gender)
        .transitionDuration(500)
        .valueAccessor(function(d) {
            var average_in_integers = d.value.average;
            average_in_integers = parseInt(average_in_integers);
            return average_in_integers;
        })
        .x(d3.scale.ordinal())
        .xUnits(dc.units.ordinal)
        .xAxisLabel("Gender")
        .yAxisLabel("Average salary")
        .yAxis().ticks(4);
}

function show_rank_distribution(ndx) {

    /* initially did this to gather all the rank details and distribut them by gender however we need to convert to percentages first 
        function rank_by_gender(rank) {
            return function(d) {
                if (d.rank === rank) {
                    return +d.rank;
                }
                else {
                    return 0;
                }
            };
        }
            var rank_by_gender_prof = dim.group().reduceSum(rank_by_gender(Prof));
            var rank_by_gender_assocprof = dim.group().reduceSum(rank_by_gender(AssocProf));
            var rank_by_gender_asstprof = dim.group().reduceSum(rank_by_gender(AsstProf));
    */

    function rank_by_gender(dimension, rank) {
        return dimension.group().reduce(
            function add_fact(p, v) {
                p.total++;
                if (v.rank == rank) {
                    p.match++;
                }
                return p;
            },

            function remove_fact(p, v) {
                p.total--;
                if (v.rank == rank) {
                    p.match--;
                }
                return p;
            },

            function initialise() {
                return { total: 0, match: 0 }; // total of all the ranks (proff,assocproff and asstproff) match of the selected rank.
            }
        );
    }

    var dim = ndx.dimension(dc.pluck("sex"));
    var rank_by_gender_prof = rank_by_gender(dim, "Prof");
    var rank_by_gender_asstprof = rank_by_gender(dim, "AsstProf");
    var rank_by_gender_assocprof = rank_by_gender(dim, "AssocProf");


    dc.barChart("#rank-distribution")
        .width(400)
        .height(300)
        .dimension(dim)
        .group(rank_by_gender_prof, "Prof")
        .stack(rank_by_gender_assocprof, "Assoc Prof")
        .stack(rank_by_gender_asstprof, "Asst Prof")
        .valueAccessor(function(d) {
            if (d.value.total > 0) {
                return (d.value.match / d.value.total) * 100;
                // remember d.value.total is the total amount of prof+asstprof+assocproff
                // d.value.match is the amount for the specific rank (prof or asstprof or assocproff)
                // to get a percentage (amount/total) * 100. quick maths !!!
            }
            else {
                return 0;
            }
        })
        .transitionDuration(500)
        .x(d3.scale.ordinal())
        .xUnits(dc.units.ordinal)
        .xAxisLabel("Gender")
        .legend(dc.legend().x(320).y(20).itemHeight(15).gap(5))
        .margins({ top: 10, right: 100, bottom: 30, left: 30 });
}

function show_percent_that_are_professors(ndx, gender, element) {

    // we just want the number so we dont use the dim or group hence why we groupAll
    // we use a similar reduce to the rank_by_gender

    var percentageThatAreProf = ndx.groupAll().reduce(
        function(p, v) {
            if (v.sex === gender) {
                p.count++;
                if (v.rank === "Prof") {
                    p.are_prof++;
                }
            }
            return p;
        },
        function(p, v) {
            if (v.sex === gender) {
                p.count--;
                if (v.rank === "Prof") {
                    p.are_prof--;
                }
            }
            return p;
        },
        function() {
            return { count: 0, are_prof: 0 };
            // count is the total number of ranks and the are_prof is the number of which are professors. 
        },
    );

    dc.numberDisplay(element)
        .formatNumber(d3.format(".2%")) // shows the number as a percentage to 2 decimal places.
        .valueAccessor(function(d) { // because we have used the custom reducer 
            if (d.count == 0) {
                return 0;
            }
            else {
                return (d.are_prof / d.count);
            }
        })
        .group(percentageThatAreProf)
}

function show_years_of_service_and_salary(ndx) {
    var service_dim = ndx.dimension(dc.pluck("yrs_service"));
    var service_and_salary_dim = ndx.dimension(function(d) {
        return [d.yrs_service, d.salary, d.sex, d.rank];

        // remember to add the sex so we can view it in the title for each point specific to that yr and salary
        // we also add the rank to see what rank
    });

    var service_salary_group = service_and_salary_dim.group();

    var minYrsOfService = service_dim.bottom(1)[0].yrs_service;
    var maxYrsOfService = service_dim.top(1)[0].yrs_service;

    var genderColors = d3.scale.ordinal()
        .domain(["Male", "Female"])
        .range(["blue", "red"]);

    dc.scatterPlot("#service-salaries")
        .width(800)
        .height(400)
        .x(d3.scale.linear().domain([minYrsOfService, maxYrsOfService]))
        .xAxisLabel("Year's of service")
        .brushOn(false)
        .symbolSize(5)
        .yAxisLabel("Salary")
        .dimension(service_and_salary_dim)
        .group(service_salary_group)
        .clipPadding(10)
        .title(function(d) {
            return d.key[3] + " earned " + d.key[1];
        })
        .margins({ top: 10, right: 50, bottom: 75, left: 75 })
        .colorAccessor(function(d) {
            return d.key[1];
        })
        .colors(genderColors);
}

function show_phd_to_salary(ndx) {
    var yrs_since_phd_dim = ndx.dimension(dc.pluck("yrs_since_phd"));
    var yrs_since_phd_and_salary_dim = ndx.dimension(function(d) {
        return [d.yrs_since_phd, d.salary, d.sex, d.rank];

        // remember to add the sex so we can view it in the title for each point specific to that yr and salary
        // we also add the rank to see what rank
    });

    var phd_salary_group = yrs_since_phd_and_salary_dim.group();

    var minYrsSincePHD = yrs_since_phd_dim.bottom(1)[0].yrs_since_phd;
    var maxYrsSincePHD = yrs_since_phd_dim.top(1)[0].yrs_since_phd;

    var genderColors = d3.scale.ordinal()
        .domain(["Male", "Female"])
        .range(["blue", "red"]);

    dc.scatterPlot("#phd-salary")
        .width(800)
        .height(400)
        .x(d3.scale.linear().domain([minYrsSincePHD, maxYrsSincePHD]))
        .xAxisLabel("Year's since PHD")
        .brushOn(false)
        .symbolSize(5)
        .yAxisLabel("Salary")
        .dimension(yrs_since_phd_and_salary_dim)
        .group(phd_salary_group)
        .clipPadding(10)
        .title(function(d) {
            return d.key[3] + " earned " + d.key[1];
        })
        .margins({ top: 10, right: 50, bottom: 75, left: 75 })
        .colorAccessor(function(d) {
            return d.key[1];
        })
        .colors(genderColors);
}