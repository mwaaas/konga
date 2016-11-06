/**
 * This file contains all necessary Angular controller definitions for 'frontend.admin.login-history' module.
 *
 * Note that this file should only contain controllers and nothing else.
 */
(function() {
  'use strict';

  angular.module('frontend.plugins')
    .controller('EditPluginController', [
        '_','$scope','$rootScope','$log',
        'MessageService','ConsumerModel','SocketHelperService','PluginHelperService',
        'KongPluginsService','$uibModalInstance','PluginsService','_plugin','_schema',
      function controller(_,$scope,$rootScope,$log,
                          MessageService,ConsumerModel,SocketHelperService,PluginHelperService,
                          KongPluginsService,$uibModalInstance,PluginsService,_plugin,_schema ) {

          $scope.plugin = _plugin
          $scope.schema = _schema.data
          $log.debug("Plugin",$scope.plugin)
          $log.debug("Schema",$scope.schema)

          //var pluginOptions = new KongPluginsService().pluginOptions()
          var options = new KongPluginsService().pluginOptions(_plugin.name)


          //$log.debug("Options", options)
          $scope.close = close


          $scope.humanizeLabel = function(key) {
              return key.split("_").join(" ")
          }

          function initialize() {
              // Initialize plugin fields data
              $scope.data = _.merge(options.fields,$scope.schema,{
                  consumer_id : $scope.plugin.consumer_id
              })

              // Define general modal window content
              $scope.description = $scope.data.meta ? $scope.data.meta.description
                  : 'Configure the Plugin.'

              // Remove unwanted data fields that start with "_"
              Object.keys($scope.data.fields).forEach(function(key){
                  if(key.startsWith("_")) delete $scope.data.fields[key]
              })

              // Monkey patch for response-ratelimiting plugin
              if(_plugin.name === 'response-ratelimiting') {
                  console.log("response-ratelimiting:limits =>",_plugin.config.limits)

                  // Delete initial schema fields
                  delete $scope.data.fields.limits.schema.fields.day
                  delete $scope.data.fields.limits.schema.fields.hour
                  delete $scope.data.fields.limits.schema.fields.minute
                  delete $scope.data.fields.limits.schema.fields.month
                  delete $scope.data.fields.limits.schema.fields.second
                  delete $scope.data.fields.limits.schema.fields.year


                  Object.keys(_plugin.config.limits).forEach(function(key){

                      //console.log("_plugin.config.limits[key]",_plugin.config.limits[key])

                      var inner_fields = {}
                      Object.keys(_plugin.config.limits[key]).forEach(function(k){
                          inner_fields[k] = {
                              type : 'number',
                              default : _plugin.config.limits[key][k]
                          }
                      })

                      $scope.data.fields.limits.schema.fields[key] = {

                          schema : {
                              fields : inner_fields
                          }
                      }
                  })

                  console.log("$scope.data =>",$scope.data)
              }


              assignValues($scope.data.fields);

              // Customize data fields according to plugin
              PluginHelperService.customizeDataFieldsForPlugin(_plugin.name,$scope.data.fields)

              // Assign extra properties from options to data fields
              PluginHelperService.assignExtraProperties(options,$scope.data.fields)
              $log.debug("Extra properties added to fields =>",$scope.data.fields)
          }



          function assignValues(fields,prefix) {

              Object.keys(fields).forEach(function (item) {
                  if(fields[item].schema) {
                      assignValues(fields[item].schema.fields,item)
                  }else{

                      var path = prefix ? prefix + "." + item : item;
                      var value = _.get(_plugin.config, path)

                      if (fields[item].type === 'array'
                          && value !== null && typeof value === 'object' && !Object.keys(value).length) {
                          value = []
                      }
                      fields[item].value = value
                      fields[item].help = _.get(options,path) ? _.get(options,path).help : ''
                  }
              })
          }




          $scope.updatePlugin = function() {

              $scope.busy = true;


              var data = {
                  enabled : $scope.plugin.enabled,
              }

              if($scope.data.consumer_id instanceof Object) {
                  data.consumer_id = $scope.data.consumer_id.id
              }


              function createConfig(fields,prefix) {

                  Object.keys(fields).forEach(function (key) {
                      if(fields[key].schema) {
                          createConfig(fields[key].schema.fields,prefix ? prefix + "." + key : key)
                      }else{
                          var path = prefix ? prefix + "." + key : key;
                          if (fields[key].value instanceof Array) {
                              // Transform to comma separated string
                              data['config.' + path] = fields[key].value.join(",")
                          } else {
                              data['config.' + path] = fields[key].value
                          }
                      }


                  })

              }

              createConfig($scope.data.fields);

              $log.debug("REQUEST DATA =>",data)

              PluginsService.update(_plugin.id,data)
                  .then(function(res){
                      $log.debug("updatePlugin",res)
                      $scope.busy = false;
                      $rootScope.$broadcast('plugin.updated',res.data)
                      MessageService.success('"' + _plugin.name + '" plugin updated successfully!')
                      $uibModalInstance.dismiss()
                  }).catch(function(err){
                  $scope.busy = false;
                  $log.error("updatePlugin",err)
                  $scope.errors = err.data.customMessage || {}
              })
          }



          // Add the consumers to the plugin options
          $scope.getConsumer = function(val) {

              // Initialize filters
              $scope.filters = {
                  searchWord: val || '',
                  columns: ['username','custom_id']
              };

              var commonParameters = {
                  where: SocketHelperService.getWhere($scope.filters)
              };

              return ConsumerModel
                  .load(_.merge({}, commonParameters, {}))
                  .then(function(response){
                      return response.map(function(item){
                          return item;
                      });
                  });
          };

          function close() {
              $uibModalInstance.dismiss()
          }

          initialize();
      }
    ])
  ;
}());
