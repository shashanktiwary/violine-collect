var fs = require("fs");
var http = require("http");
var xml = require("xml2js");


class violineFiles {
    constructor() {
        this.sitePath = 'http://www.violinet.org/violinml/';
    }
    collect() {
        http.get(this.sitePath + 'index.php', (res) => this.downloadHtml(res));
    }

    downloadHtml(response) {
        let htmlPage = '';
        response.on('data', function (data) {
            htmlPage += data;
        });
        response.on('end', () => this.processHtml(htmlPage));
    }

    processHtml(htmlPage) {
        xml.parseString(htmlPage, (error, result) => this.parsePage(error, result));
    }

    escape(val) {
        return ('"' + val + '"');
    }

    parsePage(error, result) {
        var rows = result.html.body[0].table[0].tr[0].td[1].div[0].table[0].tr;
        var headerRec;
        var bodyRecs = '';
        for (let inx = 0; inx < rows.length; inx++) {
            var rec = rows[inx];
            if (inx == 0) {
                headerRec = this.escape(rec.td[0]._) + "," + this.escape(rec.td[1]._) + "," + this.escape(rec.td[2]._) + "," + escape(rec.td[3]._) + "\n";
                //console.log(headerRec);
            }
            else {
                let pName = rec.td[1].a[0]._;
                let recId = rec.td[0]._;
                let fUrl = 'http://www.violinet.org/violinml/' + rec.td[3].a[0].$.href;
                if (!pName)
                    pName = rec.td[1].a[0].i[0];
                let fName = (recId + "_" + pName).replace(/\s/, '_') + ".xml";
                let bRec = this.escape(recId)
                    + "," + this.escape(pName)
                    + "," + this.escape(rec.td[2]._)
                    + "," + this.escape(fUrl) + "\n";
                bodyRecs += bRec;
                console.log(bRec);
                var hostStrm = fs.createWriteStream('./_hosts.csv');
                var pathoStrm = fs.createWriteStream('./_pathogens.csv');
                hostStrm.write('recId,taxon_id,common_name,scientific_name\n');
                pathoStrm.write('recId,pathogen_id,pathogen_name\n');
                http.get(fUrl, (data) => this.writePathogen(data, recId, fName, hostStrm, pathoStrm));
            }
        }
        // write to file
        fs.writeFileSync('./main_pathogens.csv', headerRec + bodyRecs);
    }

    writePathogen(xRes, recId, fName, hostStrm, pathoStrm) {
        let xmlData = '';
        xRes.on('data', function (data) {
            xmlData += data;
        });
        xRes.on('end', () => {
            var scapeXmlData = xmlData.replace(/&(?!(?:apos|quot|[gl]t|amp);|#)/g, '&amp;')
                .replace(/(<)([\s]?[.|\d]+)/g, '&gt;$2');
            fs.writeFile('./data/' + fName, scapeXmlData, function (writeError) {
                if (writeError)
                    console.log(writeError);
            });
            xml.parseString(scapeXmlData, (err, vol) => {
                if (err) {
                    console.error(recId + '----- VOL ERROR ------' + err)
                    return;
                }
                hostStrm.cork();
                pathoStrm.cork();
                // Generate Hosts file
                for (var hidx = 0; hidx < vol.VIOLIN.host.length; hidx++) {
                    var host = vol.VIOLIN.host[hidx];
                    let hostVal = recId
                        + ","
                        + this.escape(host.taxon_id[0])
                        + ","
                        + this.escape(host.common_name[0])
                        + ","
                        + this.escape(host.scientific_name[0]);
                    console.log(hostVal);
                    hostStrm.write(hostVal + '\n');
                }
                // Generate pathagen file
                for (hidx = 0; hidx < vol.VIOLIN.pathogen.length; hidx++) {
                    var patho = vol.VIOLIN.pathogen[hidx];
                    var pathoVal = recId
                        + ","
                        + this.escape(patho.$.pathogen_id)
                        + ","
                        + this.escape(patho.pathogen_name[0]);
                    console.log(pathoVal);
                    pathoStrm.write(pathoVal + '\n');
                }
                hostStrm.uncork();
                pathoStrm.uncork();
                //console.log('------- VOL -----' + vol);
            });
        });
    }
}

new violineFiles().collect();