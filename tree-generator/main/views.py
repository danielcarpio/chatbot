import json
import math
import re
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import MethodNotAllowed
from sklearn import tree
from sklearn.tree.export import export_text
from sklearn.metrics import accuracy_score
from sklearn.preprocessing import LabelEncoder
from pandas import read_json, read_csv
from pandas import DataFrame
from django.shortcuts import HttpResponse

class Tree(APIView):
    def get(self, request):
        return Response(status=status.HTTP_405_METHOD_NOT_ALLOWED)
    
    def tratamiento_datos(self, data, null_data):
        if null_data["tipo"] == "sustituir":
            return self.sustitucion(data, null_data)
        elif null_data["tipo"] == "ignorar":
            return self.ignorar(data)
        
    def sustitucion(self, data, null_data):
        res = DataFrame.copy(data)
        for c in res.columns.values:
            if res[c].isnull().values.any():
                for v in range(0, len(res[c])):
                    if not type(res[c][v]) is str and math.isnan(res[c][v]):
                        res[c][v] = null_data['valores'][c]
        return res

    def ignorar(self, data):
        res = DataFrame.copy(data)
        for i in res.iterrows():
            if i[1].isnull().values.any():
                res = res.drop(i[0])
        return res

    def transformar_json(self, lineas, label_encoders, prof, col):
        res = {
            'atributo': None,
            'ramas': []
        }
        for i in range(len(lineas)):
            fin_lineas = 4 + 4 * prof
            if lineas[i][0:fin_lineas] == prof * '|   ' + '|---':
                num_feature = re.findall('feature_\d+', lineas[i])[0][8:]
                atrib = list(label_encoders.keys())[int(num_feature)]
                if res['atributo'] is None:
                    res['atributo'] = atrib
                clasif = int(lineas[i][-4:-3])
                orden = range(clasif + 1)
                if lineas[i][-7:-6] == '>':
                    clasif += 1
                    orden = range(clasif, len(label_encoders[atrib].classes_))
                for k in orden:
                    valor = label_encoders[atrib].inverse_transform([k])[0]
                    if 'class' in lineas[i + 1]:
                        num_class = re.findall('class: \d+', lineas[i + 1])[0][7:]
                        clase = label_encoders[col].inverse_transform([int(num_class)])[0]
                        res['ramas'].append({
                            'valor': valor,
                            'siguiente': clase
                        })
                    else:
                        fin_rama = len(lineas)
                        for j in range(len(lineas[i + 1:])):
                            if lineas[i + 1 + j][0:fin_lineas] == prof * '|   ' + '|---':
                                fin_rama = i + 1 + j
                                break
                        res['ramas'].append({
                            'valor': valor,
                            'siguiente': self.transformar_json(lineas[i + 1:fin_rama], label_encoders, prof + 1, col)
                        })
        return res

    def post(self, request):
        fileD = request.FILES['archivo']
        formato = request.POST.get('formato')
        col = request.POST.get('columna_objetivo')
        max_depth = request.POST.get('profundidad')
        null_data = request.POST.get('datos_null')

        if col == None or col == "":
            return Response(status=status.HTTP_400_BAD_REQUEST)

        if formato=="JSON":
            data = read_json(fileD)
        elif formato=="CSV":
            data = read_csv(fileD)
        else:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        if data.isnull().values.any():
            if not null_data is None:
                data = self.tratamiento_datos(data, json.loads(null_data))
            else:
                data = self.ignorar(data)

        if not col in data.columns.values:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        if max_depth is None or int(max_depth) == 0 or int(max_depth) < 0:
            clf = tree.DecisionTreeClassifier()
        else:
            clf = tree.DecisionTreeClassifier(max_depth=int(max_depth))

        labels_encoders = {}
        for d in data:
            le = LabelEncoder()
            le.fit(data[d])
            labels_encoders[d] = le
            data[d] = le.transform(data[d])
        
        x = DataFrame.copy(data).drop(col, axis=1)
        y = DataFrame.copy(data).drop(data.columns.difference([col]), axis=1)

        clf.fit(x, y)

        tree_text = export_text(clf)
        jsonres = self.transformar_json(tree_text.split('\n'), labels_encoders, 0, col)
        return Response(jsonres, status=status.HTTP_200_OK)