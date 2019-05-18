'use strict';

const {dialogflow, Suggestions} = require('actions-on-google');
const express = require('express');
const bodyParser = require('body-parser');
const rp = require('request-promise');
var fs = require('fs');
var path = require('path');

const app = dialogflow({debug: true});

var diccio = {
    Outlook: 'cielo',
    overcast: 'nublado',
    sunny: 'soleado',
    rain: 'lluvia',
    Wind: 'viento',
    weak: 'debil',
    strong: 'fuerte',
    Humidity: 'humedad',
    normal: 'baja',
    high: 'alta',
    Temeperature: 'temperatura',
    cool: 'frio',
    mild: 'suave',
    hot: 'calor',
    yes: 'si',
    no: 'no'
};

var arbol = {
    atributo: "cielo",
    ramas: [
        {
            valor: "soleado",
            siguiente: {
                atributo: "humedad",
                ramas: [
                    {
                        valor: "alta",
                        siguiente: "no"
                    },
                    {
                        valor: "baja",
                        siguiente: "si"
                    }
                ]
            }
        },
        {
            valor: "nublado",
            siguiente: "si"
        },
        {
            valor: "lluvia",
            siguiente: {
                atributo: "viento",
                ramas: [
                    {
                        valor: "debil",
                        siguiente: "si"
                    },
                    {
                        valor: "fuerte",
                        siguiente: "no"
                    }
                ]
            }
        }
    ]
};

var sugerencias = {
    viento: ['Fuerte', 'Débil', 'Flojo', 'Mucho', 'Poco', 'Suave'],
    cielo: ['Soleado', 'Nublado', 'Lluvioso', 'Granizo', 'Nieve', 'Cubierto', 'Despejado'],
    temperatura: ['Calor', 'Frío', 'Suave', 'Alta', 'Baja', 'Fresco'],
    humedad: ['Alta', 'Baja', 'Normal', 'Mucha', 'Poca']
};

function generarArbol(conv) {
    return new Promise((resolve, reject) => {
        var formData = {
            archivo: fs.createReadStream(path.join(__dirname, 'tennis-full.txt')),
            formato: 'JSON',
            columna_objetivo: 'value'
        };
        if (conv.data.profundidad) formData.profundidad = conv.data.profundidad;
        if (conv.data.nulos) formData.datos_null = conv.data.datos_null;
        rp({
            uri: 'https://tree-generator-sklearn.herokuapp.com',
            method: 'POST',
            formData: formData
        }).then(body => {
            var strdata = body;
            Object.getOwnPropertyNames(diccio).forEach(trad => {
                strdata = strdata.replace(new RegExp('"' + trad + '"', 'g'), '"' + diccio[trad] + '"');
            });
            resolve(JSON.parse(strdata));
        }).catch(err => {
            reject(err);
        });
    });
}

function hacerPregunta(conv) {
    var estado = conv.data.estado;
    if (!estado || !estado.atributo) {
        conv.close('Lo siento, hubo un problema.');
    } else if (estado.atributo === 'cielo') {
        conv.contexts.set('cielo', 5);
        conv.contexts.set('humedad', 0);
        conv.contexts.set('temperatura', 0);
        conv.contexts.set('viento', 0);
        conv.ask(cadenaAleatoria([
            'Dime cómo está el cielo.',
            'Por favor, dime cómo está el cielo ahora.'
        ]));
        var sugerido = sugerencias.cielo.slice(0, 2);
        if (sugerencias.cielo.length > 2) sugerido.push('Otros');
        conv.data.prevcielo = sugerido;
        conv.ask(new Suggestions(sugerido));
    } else if (estado.atributo === 'humedad') {
        conv.contexts.set('cielo', 0);
        conv.contexts.set('humedad', 5);
        conv.contexts.set('temperatura', 0);
        conv.contexts.set('viento', 0);
        conv.ask(cadenaAleatoria([
            'Dime cómo está la humedad.',
            'Por favor, dime la humedad que hace ahora.'
        ]));
        var sugerido = sugerencias.humedad.slice(0, 2);
        if (sugerencias.humedad.length > 2) sugerido.push('Otros');
        conv.data.prevhumedad = sugerido;
        conv.ask(new Suggestions(sugerido));
    } else if (estado.atributo === 'temperatura') {
        conv.contexts.set('cielo', 0);
        conv.contexts.set('humedad', 0);
        conv.contexts.set('temperatura', 5);
        conv.contexts.set('viento', 0);
        conv.ask(cadenaAleatoria([
            'Dime cómo está la temperatura.',
            'Por favor, dime qué temperatura hace.'
        ]));
        var sugerido = sugerencias.temperatura.slice(0, 2);
        if (sugerencias.temperatura.length > 2) sugerido.push('Otros');
        conv.data.prevtemperatura = sugerido;
        conv.ask(new Suggestions(sugerido));
    } else if (estado.atributo === 'viento') {
        conv.contexts.set('cielo', 0);
        conv.contexts.set('humedad', 0);
        conv.contexts.set('temperatura', 0);
        conv.contexts.set('viento', 5);
        conv.ask(cadenaAleatoria([
            'Dime cómo está el viento.',
            'Por favor, dime cómo está el viento ahora.'
        ]));
        var sugerido = sugerencias.viento.slice(0, 2);
        if (sugerencias.viento.length > 2) sugerido.push('Otros');
        conv.data.prevviento = sugerido;
        conv.ask(new Suggestions(sugerido));
    }
}

function procesarRespuesta(conv, atrib, valor) {
    if (!conv.data.respuestas[atrib]) conv.data.respuestas[atrib] = valor;
    conv.data.estado = conv.data.estado.ramas.find(rama => rama.valor === valor).siguiente;
    if (conv.data.estado === 'no') {
        conv.close(cadenaAleatoria([
            'Es mejor que hoy no salgas a jugar.',
            'Te recomiendo que no juegues hoy.'
        ]));
    } else if (conv.data.estado === 'si') {
        conv.close(cadenaAleatoria([
            '¡Estupendo! Hoy puedes salir a jugar.',
            'Hoy hace un día perfecto para jugar.'
        ]));
    } else if (typeof conv.data.estado === 'object') {
        var antiguaRespuesta = Object.getOwnPropertyNames(conv.data.respuestas).find(atr => atr === conv.data.estado.atributo);
        if (antiguaRespuesta) {
            procesarRespuesta(conv, antiguaRespuesta, conv.data.respuestas[antiguaRespuesta]);
        } else {
            hacerPregunta(conv);
        }
    }
}

function cadenaAleatoria(cadenas) {
    return cadenas[Math.floor(Math.random()*cadenas.length)];
}

function procesarNavegacion(conv, atrib, navegacion) {
    if (navegacion === 'siguiente') {
        conv.contexts.set(atrib, 5);
        if (conv.data[atrib + 'nav'] + 2 >= sugerencias[atrib].length) {
            conv.ask('No hay más sugerencias.');
            conv.ask(new Suggestions(conv.data['prev' + atrib]));
        } else {
            conv.data[atrib + 'nav'] += 2;
            conv.ask('Aquí tienes más sugerencias.');
            var sugerido = sugerencias[atrib].slice(conv.data[atrib + 'nav'], conv.data[atrib + 'nav'] + 2);
            sugerido.push('Anteriores');
            if (conv.data[atrib + 'nav'] + 2 < sugerencias[atrib].length) sugerido.push('Otros');
            conv.data['prev' + atrib] = sugerido;
            conv.ask(new Suggestions(sugerido));
        }
    } else if (navegacion === 'atras') {
        conv.contexts.set('cielo', 5);
        if (conv.data[atrib + 'nav'] <= 0) {
            conv.ask('No hay más sugerencias.');
            conv.ask(new Suggestions(conv.data['prev' + atrib]));
        } else {
            conv.data[atrib + 'nav'] -= 2;
            conv.ask('Aquí tienes las sugerencias anteriores.');
            var sugerido = sugerencias[atrib].slice(conv.data[atrib + 'nav'], conv.data[atrib + 'nav'] + 2);
            if (conv.data[atrib + 'nav'] > 0) sugerido.push('Anteriores');
            if (conv.data[atrib + 'nav'] + 2 < sugerencias[atrib].length) sugerido.push('Otros');
            conv.data['prev' + atrib] = sugerido;
            conv.ask(new Suggestions(sugerido));
        }
    }
}

app.intent('genarbol', (conv, {}) => {
    conv.contexts.set('profundidad', 5);
    conv.ask(cadenaAleatoria([
        'Dime la profundidad máxima que quieres.',
        '¿Qué profundidad máxima quieres?'
    ]));
    conv.ask(new Suggestions(['Sin límite', '1', '3']));
});

app.intent('pregprofundidad', (conv, {profundidad}) => {
    conv.data.profundidad = profundidad;
    conv.contexts.set('profundidad', 0);
    conv.contexts.set('nulos', 5);
    conv.ask(cadenaAleatoria([
        'Dime si quieres sustituir los valores nulos.',
        '¿Quieres sustituir los valores nulos?'
    ]));
    conv.ask(new Suggestions(['Sí', 'No']));
});

app.intent('pregnulos', (conv, {decision}) => {
    conv.contexts.set('nulos', 0);
    if (decision === 'si') {
        conv.contexts.set('sustituir', 20);
        conv.ask(cadenaAleatoria([
            'Dime qué valores quieres para los atributos.',
            '¿Qué valores quieres usar para los atributos?'
        ]));
        conv.ask(' El cielo puede estar soleado, nublado o lluvioso; la humedad puede ser alta o baja; la temperatura puede ser alta, baja o suave; y la intensidad del viento puede ser fuerte o débil.');
    } else if (decision === 'no') {
        return generarArbol(conv)
        .then(data => {
            arbol = data;
            conv.close('Se ha generado el árbol.');
        })
        .catch(err => {
            conv.close('Lo siento, hubo un problema');
        });
    }
});

app.intent('pregsustituir', (conv, {cielo, humedad, temperatura, intviento}) => {
    conv.contexts.set('sustituir', 0);
    conv.data.datos_null = {
        tipo: 'sustituir',
        valores: {
            Outlook: Object.getOwnPropertyNames(diccio).find(atr => diccio[atr] === cielo),
            Humidity: Object.getOwnPropertyNames(diccio).find(atr => diccio[atr] === humedad),
            Temperature: Object.getOwnPropertyNames(diccio).find(atr => diccio[atr] === temperatura),
            Wind: Object.getOwnPropertyNames(diccio).find(atr => diccio[atr] === intviento)
        }
    }
    return generarArbol(conv)
    .then(data => {
        arbol = data;
        conv.close('Se ha generado el árbol.');
    })
    .catch(err => {
        conv.close('Lo siento, hubo un problema');
    });
});

app.intent('pregjugar', (conv, {}) => {
    conv.data.estado = JSON.parse(JSON.stringify(arbol));
    conv.data.respuestas = {};
    conv.data.vientonav = 0;
    conv.data.cielonav = 0;
    conv.data.temperaturanav = 0;
    conv.data.humedadnav = 0;
    hacerPregunta(conv);
});

app.intent('pregviento', (conv, {intviento, navegacion}) => {
    if (navegacion) {
        procesarNavegacion(conv, 'viento', navegacion);
    } else if (intviento) {
        procesarRespuesta(conv, 'viento', intviento);
    }
});

app.intent('pregtemperatura', (conv, {temperatura, navegacion}) => {
    if (navegacion) {
        procesarNavegacion(conv, 'temperatura', navegacion);
    } else if (temperatura) {
        procesarRespuesta(conv, 'temperatura', temperatura);
    }
});

app.intent('pregcielo', (conv, {cielo, navegacion}) => {
    if (navegacion) {
        procesarNavegacion(conv, 'cielo', navegacion);
    } else if (cielo) {
        procesarRespuesta(conv, 'cielo', cielo);
    }
});

app.intent('preghumedad', (conv, {humedad, navegacion}) => {
    if (navegacion) {
        procesarNavegacion(conv, 'humedad', navegacion);
    } else if (humedad) {
        procesarRespuesta(conv, 'humedad', humedad);
    }
});

const expressApp = express().use(bodyParser.json());

expressApp.post('/fulfillment', app);

expressApp.listen(process.env.PORT || 3000);
